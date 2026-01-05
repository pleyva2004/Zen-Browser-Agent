"""
API endpoint tests.
"""

import pytest


def test_health_check(client):
    """Test health check endpoint."""
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"


def test_list_providers(client):
    """Test providers endpoint."""
    response = client.get("/providers")
    assert response.status_code == 200
    data = response.json()
    assert "providers" in data
    assert "default" in data


def test_plan_rule_based(client, sample_request):
    """Test planning with rule-based provider."""
    sample_request["provider"] = "rule_based"
    response = client.post("/plan", json=sample_request)
    assert response.status_code == 200
    data = response.json()
    assert "summary" in data
    assert "steps" in data