"""
Error handling tests.

Tests for error scenarios, fallback behavior, and edge cases.
"""

import pytest
from unittest.mock import patch, AsyncMock
from fastapi.testclient import TestClient

from app.main import app
from app.schemas import PlanResponse


@pytest.fixture
def client():
    """Create a test client."""
    return TestClient(app)


@pytest.fixture
def sample_request():
    """Create a sample plan request."""
    return {
        "userRequest": "search for cats",
        "page": {
            "url": "https://google.com",
            "title": "Google",
            "text": "Search the web",
            "candidates": [
                {
                    "selector": "input[name='q']",
                    "tag": "input",
                    "text": "",
                    "ariaLabel": "",
                    "placeholder": "Search",
                    "name": "q",
                    "type": "text",
                    "href": "",
                },
            ],
        },
    }


class TestErrorHandling:
    """Test error handling in the API."""

    def test_invalid_provider(self, client, sample_request):
        """Test that invalid provider returns validation error."""
        sample_request["provider"] = "invalid_provider"
        response = client.post("/plan", json=sample_request)
        # Pydantic validates provider enum before reaching handler
        assert response.status_code == 422  # Validation error

    def test_malformed_request_missing_user_request(self, client):
        """Test that missing userRequest returns 422 error."""
        response = client.post("/plan", json={
            "page": {
                "url": "https://example.com",
                "title": "Test",
                "text": "",
                "candidates": [],
            }
        })
        assert response.status_code == 422

    def test_malformed_request_missing_page(self, client):
        """Test that missing page returns 422 error."""
        response = client.post("/plan", json={
            "userRequest": "search for cats"
        })
        assert response.status_code == 422

    def test_empty_candidates_list(self, client, sample_request):
        """Test that empty candidates list doesn't crash."""
        sample_request["page"]["candidates"] = []
        sample_request["provider"] = "rule_based"
        response = client.post("/plan", json=sample_request)
        assert response.status_code == 200
        data = response.json()
        assert "summary" in data
        # Should return empty steps since no candidates to work with
        assert data["steps"] == []


class TestFallbackBehavior:
    """Test fallback to rule_based planner."""

    def test_rule_based_works(self, client, sample_request):
        """Test that rule_based planner works correctly."""
        sample_request["provider"] = "rule_based"
        response = client.post("/plan", json=sample_request)
        assert response.status_code == 200
        data = response.json()
        assert "summary" in data
        assert "steps" in data
        # Should generate steps for search
        assert len(data["steps"]) > 0

    def test_fallback_on_missing_api_key(self, client, sample_request):
        """Test that missing API key falls back to rule_based."""
        sample_request["provider"] = "anthropic"
        # Without ANTHROPIC_API_KEY set, should fall back
        response = client.post("/plan", json=sample_request)
        # Should still return 200 due to fallback
        assert response.status_code == 200
        data = response.json()
        assert "summary" in data


class TestHealthEndpoints:
    """Test health check endpoints."""

    def test_basic_health(self, client):
        """Test basic health endpoint."""
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert data["version"] == "0.2.0"

    def test_detailed_health(self, client):
        """Test detailed health endpoint."""
        response = client.get("/health/detailed")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert "providers" in data
        assert "rule_based" in data["providers"]
        assert data["providers"]["rule_based"]["status"] == "available"
        assert "available_providers" in data
        assert data["available_providers"] >= 2  # rule_based and local are always available

    def test_providers_endpoint(self, client):
        """Test providers list endpoint."""
        response = client.get("/providers")
        assert response.status_code == 200
        data = response.json()
        assert "providers" in data
        assert "default" in data
        assert "rule_based" in data["providers"]


class TestEdgeCases:
    """Test edge cases and boundary conditions."""

    def test_very_long_user_request(self, client, sample_request):
        """Test handling of very long user request."""
        sample_request["userRequest"] = "search " + "a" * 10000
        sample_request["provider"] = "rule_based"
        response = client.post("/plan", json=sample_request)
        assert response.status_code == 200

    def test_special_characters_in_request(self, client, sample_request):
        """Test handling of special characters."""
        sample_request["userRequest"] = "search for <script>alert('xss')</script>"
        sample_request["provider"] = "rule_based"
        response = client.post("/plan", json=sample_request)
        assert response.status_code == 200

    def test_unicode_in_request(self, client, sample_request):
        """Test handling of unicode characters."""
        sample_request["userRequest"] = "search for 猫 emoji 🐱"
        sample_request["provider"] = "rule_based"
        response = client.post("/plan", json=sample_request)
        assert response.status_code == 200

    def test_scroll_command(self, client, sample_request):
        """Test scroll command."""
        sample_request["userRequest"] = "scroll down"
        sample_request["provider"] = "rule_based"
        response = client.post("/plan", json=sample_request)
        assert response.status_code == 200
        data = response.json()
        assert len(data["steps"]) > 0
        assert data["steps"][0]["tool"] == "SCROLL"

    def test_click_command(self, client, sample_request):
        """Test click command."""
        sample_request["userRequest"] = "click Search"
        sample_request["page"]["candidates"].append({
            "selector": "button",
            "tag": "button",
            "text": "Search",
            "ariaLabel": "",
            "placeholder": "",
            "name": "",
            "type": "submit",
            "href": "",
        })
        sample_request["provider"] = "rule_based"
        response = client.post("/plan", json=sample_request)
        assert response.status_code == 200
        data = response.json()
        assert len(data["steps"]) > 0
        assert data["steps"][0]["tool"] == "CLICK"
