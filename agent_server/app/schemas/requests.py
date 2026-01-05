"""
Request schemas for the planning API.

These models define the structure of incoming requests to the /plan endpoint.
"""

from pydantic import BaseModel, Field
from typing import Literal, Optional, List


# Type alias for provider names (must match config.py)
Provider = Literal["rule_based", "anthropic", "openai", "gemini", "local"]


class Candidate(BaseModel):
    """
    A candidate DOM element that can be interacted with.

    Extracted from the page by the content script and sent to the planner
    to help identify which elements to target for actions.

    Attributes:
        selector: CSS selector to uniquely identify this element.
        tag: HTML tag name (e.g., "button", "input", "a").
        text: Visible text content of the element.
        ariaLabel: Value of aria-label attribute for accessibility.
        placeholder: Placeholder text (for input elements).
        name: Value of name attribute.
        type: Value of type attribute (for input elements).
        href: Value of href attribute (for links).
    """

    selector: str
    """CSS selector to uniquely identify this element."""

    tag: str
    """HTML tag name (e.g., 'button', 'input', 'a')."""

    text: str = ""
    """Visible text content of the element (truncated to 80 chars)."""

    ariaLabel: str = ""
    """Value of aria-label attribute for accessibility."""

    placeholder: str = ""
    """Placeholder text (for input elements)."""

    name: str = ""
    """Value of name attribute."""

    type: str = ""
    """Value of type attribute (for input elements)."""

    href: str = ""
    """Value of href attribute (for links)."""


class PageSnapshot(BaseModel):
    """
    A snapshot of the current page state.

    Contains all the information the planner needs to understand
    the current page and generate appropriate actions.

    Attributes:
        url: The current page URL.
        title: The page title.
        text: Visible text content of the page (truncated).
        candidates: List of interactive elements on the page.
    """

    url: str
    """The current page URL."""

    title: str
    """The page title from document.title."""

    text: str
    """Visible text content of the page (truncated to ~40000 chars)."""

    candidates: List[Candidate] = Field(default_factory=list)
    """List of interactive elements extracted from the page."""


class PlanRequest(BaseModel):
    """
    Request to generate an execution plan.

    Sent by the extension sidebar when the user enters a goal.
    Contains the user's request, current page state, and optional
    screenshot for visual understanding.

    Attributes:
        userRequest: The user's goal in natural language.
        page: Current page state snapshot.
        screenshotDataUrl: Optional base64 screenshot for vision models.
        provider: Optional provider override (uses default if not specified).

    Example:
        {
            "userRequest": "search for machine learning",
            "page": {
                "url": "https://google.com",
                "title": "Google",
                "text": "...",
                "candidates": [...]
            },
            "provider": "anthropic"
        }
    """

    userRequest: str
    """The user's goal in natural language (e.g., 'search for cats')."""

    page: PageSnapshot
    """Current page state including URL, title, text, and interactive elements."""

    screenshotDataUrl: Optional[str] = None
    """Optional base64-encoded screenshot data URL for vision models."""

    provider: Optional[Provider] = None
    """Optional provider override. If not specified, uses default from config."""
