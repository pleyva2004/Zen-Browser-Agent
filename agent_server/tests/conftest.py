"""
Pytest configuration and fixtures.
"""

import pytest
from fastapi.testclient import TestClient

from app.main import app


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
                {
                    "selector": "button[type='submit']",
                    "tag": "button",
                    "text": "Search",
                    "ariaLabel": "Google Search",
                    "placeholder": "",
                    "name": "",
                    "type": "submit",
                    "href": "",
                },
            ],
        },
    }