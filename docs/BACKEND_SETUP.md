# Backend Setup Guide

A comprehensive guide to restructuring the Zen Browser Agent backend from a single-file MVP to a modular, production-ready architecture.

---

## Table of Contents

- [Architecture Decisions](#architecture-decisions)
- [Target Directory Structure](#target-directory-structure)
- [Step 0: Prerequisites](#step-0-prerequisites)
- [Step 1: Create Directory Structure](#step-1-create-directory-structure)
- [Step 2: Create Configuration Module](#step-2-create-configuration-module)
- [Step 3: Create Request Schemas](#step-3-create-request-schemas)
- [Step 4: Create Response Schemas](#step-4-create-response-schemas)
- [Step 5: Create Schema Barrel Exports](#step-5-create-schema-barrel-exports)
- [Step 6: Create Candidate Matcher](#step-6-create-candidate-matcher)
- [Step 7: Create Base Planner Interface](#step-7-create-base-planner-interface)
- [Step 8: Create Rule-Based Planner Strategy](#step-8-create-rule-based-planner-strategy)
- [Step 9: Create Anthropic Planner Strategy](#step-9-create-anthropic-planner-strategy)
- [Step 10: Create OpenAI Planner Strategy](#step-10-create-openai-planner-strategy)
- [Step 11: Create Gemini Planner Strategy](#step-11-create-gemini-planner-strategy)
- [Step 12: Create Local LLM Planner Strategy](#step-12-create-local-llm-planner-strategy)
- [Step 13: Create Planner Factory](#step-13-create-planner-factory)
- [Step 14: Create System Prompts](#step-14-create-system-prompts)
- [Step 15: Create FastAPI Dependencies](#step-15-create-fastapi-dependencies)
- [Step 16: Create Plan Router](#step-16-create-plan-router)
- [Step 17: Create Main Application](#step-17-create-main-application)
- [Step 18: Create Entry Point](#step-18-create-entry-point)
- [Step 19: Update Requirements](#step-19-update-requirements)
- [Step 20: Create Environment Template](#step-20-create-environment-template)
- [Step 21: Create Test Configuration](#step-21-create-test-configuration)
- [Step 22: Clean Up Old Files](#step-22-clean-up-old-files)
- [Running the Server](#running-the-server)
- [Testing](#testing)

---

## Architecture Decisions

The following architectural decisions were made for this backend restructuring:

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Architecture Pattern** | Strategy Pattern | Clean interface for multiple LLM providers, easy to add/swap planners |
| **LLM Selection** | Hybrid | Default provider in config, optional per-request override in body |
| **Async/Sync** | Async throughout | LLM calls are I/O bound (2-30+ seconds), async enables concurrency |
| **Config Management** | Pydantic Settings | Type-safe, validates on startup, IDE autocomplete, .env support |

---

## Target Directory Structure

```
agent_server/
├── app/
│   ├── __init__.py
│   ├── main.py                    # FastAPI app, middleware, lifespan
│   ├── config.py                  # Pydantic Settings
│   ├── dependencies.py            # FastAPI dependency injection
│   │
│   ├── schemas/
│   │   ├── __init__.py
│   │   ├── requests.py            # PlanRequest, Candidate, PageSnapshot
│   │   └── responses.py           # PlanResponse, Step
│   │
│   ├── routers/
│   │   ├── __init__.py
│   │   └── plan.py                # POST /plan endpoint
│   │
│   └── planner/
│       ├── __init__.py
│       ├── base.py                # Abstract BasePlanner
│       ├── matcher.py             # best_match() logic
│       ├── factory.py             # Planner factory (creates planner by provider)
│       ├── strategies/
│       │   ├── __init__.py
│       │   ├── rule_based.py      # Current heuristic planner
│       │   ├── anthropic.py       # Claude planner
│       │   ├── openai.py          # GPT planner
│       │   ├── gemini.py          # Gemini planner
│       │   └── local.py           # Local LLM planner
│       └── prompts/
│           ├── __init__.py
│           └── system.py          # Shared system prompts
│
├── tests/
│   ├── __init__.py
│   ├── conftest.py                # Pytest fixtures
│   ├── test_matcher.py
│   ├── test_rule_based.py
│   └── test_api.py
│
├── .env.example                   # Template for environment variables
├── .gitignore
├── requirements.txt               # Updated dependencies
└── run.py                         # Entry point: uvicorn runner
```

---

## Step 0: Prerequisites

Ensure you have the virtual environment set up:

```bash
cd agent_server
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
```

---

## Step 1: Create Directory Structure

Create all the necessary directories and `__init__.py` files:

```bash
cd agent_server

# Create directories
mkdir -p app/schemas
mkdir -p app/routers
mkdir -p app/planner/strategies
mkdir -p app/planner/prompts
mkdir -p tests

# Create __init__.py files
touch app/__init__.py
touch app/schemas/__init__.py
touch app/routers/__init__.py
touch app/planner/__init__.py
touch app/planner/strategies/__init__.py
touch app/planner/prompts/__init__.py
touch tests/__init__.py
```

Verify the structure:

```bash
tree app tests
```

---

## Step 2: Create Configuration Module

Create `app/config.py` with Pydantic Settings:

```python
"""
Application configuration using Pydantic Settings.

Loads configuration from environment variables and .env file.
Provides type-safe access to all settings with validation.
"""

from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


# Type alias for provider names
Provider = Literal["rule_based", "anthropic", "openai", "gemini", "local"]


class Settings(BaseSettings):
    """
    Application settings loaded from environment variables.

    All settings can be overridden via environment variables.
    Environment variables are case-insensitive.

    Example:
        ANTHROPIC_API_KEY=sk-ant-xxx
        DEFAULT_PROVIDER=anthropic
    """

    # ===========================================
    # LLM Provider API Keys
    # ===========================================

    anthropic_api_key: str | None = None
    """Anthropic API key for Claude models. Required if using anthropic provider."""

    openai_api_key: str | None = None
    """OpenAI API key for GPT models. Required if using openai provider."""

    gemini_api_key: str | None = None
    """Google Gemini API key. Required if using gemini provider."""

    # ===========================================
    # LLM Configuration
    # ===========================================

    default_provider: Provider = "rule_based"
    """Default LLM provider to use when not specified in request."""

    anthropic_model: str = "claude-sonnet-4-20250514"
    """Anthropic model to use for planning."""

    openai_model: str = "gpt-4o"
    """OpenAI model to use for planning."""

    gemini_model: str = "gemini-1.5-pro"
    """Google Gemini model to use for planning."""

    local_model_url: str = "http://localhost:11434/api/generate"
    """URL for local LLM API (e.g., Ollama)."""

    local_model_name: str = "llama3"
    """Model name for local LLM."""

    # ===========================================
    # Server Configuration
    # ===========================================

    host: str = "127.0.0.1"
    """Host to bind the server to."""

    port: int = 8765
    """Port to run the server on."""

    debug: bool = False
    """Enable debug mode with additional logging."""

    reload: bool = False
    """Enable auto-reload on file changes (development only)."""

    # ===========================================
    # CORS Configuration
    # ===========================================

    cors_origins: list[str] = ["*"]
    """Allowed CORS origins. Use ["*"] for development, restrict in production."""

    cors_allow_credentials: bool = False
    """Whether to allow credentials in CORS requests."""

    cors_allow_methods: list[str] = ["*"]
    """Allowed HTTP methods for CORS."""

    cors_allow_headers: list[str] = ["*"]
    """Allowed headers for CORS."""

    # ===========================================
    # Pydantic Settings Configuration
    # ===========================================

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    """
    Get cached settings instance.

    Uses lru_cache to ensure settings are only loaded once.
    This is the recommended way to access settings throughout the application.

    Returns:
        Settings: The application settings instance.
    """
    return Settings()
```

---

## Step 3: Create Request Schemas

Create `app/schemas/requests.py` with all request-related Pydantic models:

```python
"""
Request schemas for the planning API.

These models define the structure of incoming requests to the /plan endpoint.
"""

from pydantic import BaseModel, Field
from typing import Literal


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

    candidates: list[Candidate] = Field(default_factory=list)
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

    screenshotDataUrl: str | None = None
    """Optional base64-encoded screenshot data URL for vision models."""

    provider: Provider | None = None
    """Optional provider override. If not specified, uses default from config."""
```

---

## Step 4: Create Response Schemas

Create `app/schemas/responses.py` with all response-related Pydantic models:

```python
"""
Response schemas for the planning API.

These models define the structure of responses from the /plan endpoint.
"""

from pydantic import BaseModel
from typing import Literal


# Available tool operations
Tool = Literal["CLICK", "TYPE", "SCROLL", "NAVIGATE"]


class Step(BaseModel):
    """
    A single step in an execution plan.

    Represents one action the browser extension should perform.
    The tool field determines which operation to execute, and the
    other fields provide parameters for that operation.

    Attributes:
        tool: The operation to perform (CLICK, TYPE, SCROLL, NAVIGATE).
        selector: CSS selector for the target element (CLICK, TYPE).
        text: Text to type (TYPE only).
        deltaY: Scroll amount in pixels (SCROLL only).
        url: URL to navigate to (NAVIGATE only).
        note: Human-readable explanation of this step.

    Examples:
        Click: {"tool": "CLICK", "selector": "#submit-btn", "note": "Submit form"}
        Type:  {"tool": "TYPE", "selector": "input[name=q]", "text": "hello", "note": "Type query"}
        Scroll: {"tool": "SCROLL", "deltaY": 500, "note": "Scroll down"}
        Navigate: {"tool": "NAVIGATE", "url": "https://example.com", "note": "Go to page"}
    """

    tool: Tool
    """The operation to perform: CLICK, TYPE, SCROLL, or NAVIGATE."""

    selector: str | None = None
    """CSS selector for the target element. Required for CLICK and TYPE."""

    text: str | None = None
    """Text to type into the element. Required for TYPE."""

    deltaY: int | None = None
    """Scroll amount in pixels. Positive = down, negative = up. Used for SCROLL."""

    url: str | None = None
    """URL to navigate to. Required for NAVIGATE."""

    note: str | None = None
    """Human-readable explanation of what this step does."""


class PlanResponse(BaseModel):
    """
    Response containing an execution plan.

    Returned by the /plan endpoint with a summary of the plan
    and a list of steps to execute.

    Attributes:
        summary: Human-readable summary of the plan.
        steps: Ordered list of steps to execute.
        error: Error message if planning failed.

    Example:
        {
            "summary": "Searching for 'machine learning'",
            "steps": [
                {"tool": "CLICK", "selector": "input[name=q]", "note": "Focus search"},
                {"tool": "TYPE", "selector": "input[name=q]", "text": "machine learning"},
                {"tool": "CLICK", "selector": "button[type=submit]", "note": "Submit"}
            ]
        }
    """

    summary: str
    """Human-readable summary of what the plan will do."""

    steps: list[Step]
    """Ordered list of steps to execute."""

    error: str | None = None
    """Error message if planning failed. Steps will be empty if error is set."""
```

---

## Step 5: Create Schema Barrel Exports

Create `app/schemas/__init__.py` to export all schemas from a single location:

```python
"""
Schema barrel exports.

Import all schemas from this module for cleaner imports:

    from app.schemas import PlanRequest, PlanResponse, Step
"""

from app.schemas.requests import (
    Candidate,
    PageSnapshot,
    PlanRequest,
    Provider,
)
from app.schemas.responses import (
    PlanResponse,
    Step,
    Tool,
)

__all__ = [
    # Request schemas
    "Candidate",
    "PageSnapshot",
    "PlanRequest",
    "Provider",
    # Response schemas
    "PlanResponse",
    "Step",
    "Tool",
]
```

---

## Step 6: Create Candidate Matcher

Create `app/planner/matcher.py` with the element matching logic:

```python
"""
Candidate element matcher.

Provides functions to find the best matching DOM element
from a list of candidates based on keywords and tag filters.
"""

from app.schemas import Candidate


def best_match(
    candidates: list[Candidate],
    include_tags: set[str],
    keywords: list[str],
) -> Candidate | None:
    """
    Find the best matching candidate element.

    Scores each candidate based on:
    - Keyword matches in text, ariaLabel, placeholder, name, href (+2 each)
    - Presence of ariaLabel (+1)
    - Presence of placeholder (+1)
    - Presence of text (+1)

    Args:
        candidates: List of candidate elements to search.
        include_tags: Set of allowed tag names (e.g., {"input", "button"}).
        keywords: List of keywords to match against.

    Returns:
        The best matching candidate, or None if no match found.

    Example:
        >>> candidates = [Candidate(selector="#search", tag="input", placeholder="Search")]
        >>> best_match(candidates, {"input"}, ["search"])
        Candidate(selector="#search", ...)
    """
    # Normalize keywords to lowercase, filter empty
    keywords_lower = [k.lower().strip() for k in keywords if k and k.strip()]

    if not keywords_lower:
        return None

    best: Candidate | None = None
    best_score = -1

    for candidate in candidates:
        # Filter by tag
        if candidate.tag.lower() not in include_tags:
            continue

        # Build searchable text from all fields
        haystack = " ".join([
            candidate.text or "",
            candidate.ariaLabel or "",
            candidate.placeholder or "",
            candidate.name or "",
            candidate.href or "",
        ]).lower()

        # Calculate score
        score = 0

        # Keyword matches (+2 each)
        for keyword in keywords_lower:
            if keyword in haystack:
                score += 2

        # Bonus for well-labeled elements
        if candidate.ariaLabel:
            score += 1
        if candidate.placeholder:
            score += 1
        if candidate.text:
            score += 1

        # Update best if this is higher
        if score > best_score:
            best_score = score
            best = candidate

    return best


def find_search_input(candidates: list[Candidate]) -> Candidate | None:
    """
    Find a search input element.

    Convenience function that looks for input/textarea elements
    with search-related attributes.

    Args:
        candidates: List of candidate elements to search.

    Returns:
        The best matching search input, or None if not found.
    """
    return best_match(
        candidates,
        include_tags={"input", "textarea"},
        keywords=["search", "q", "query", "find", "looking for"],
    )


def find_submit_button(candidates: list[Candidate]) -> Candidate | None:
    """
    Find a submit/search button element.

    Args:
        candidates: List of candidate elements to search.

    Returns:
        The best matching submit button, or None if not found.
    """
    return best_match(
        candidates,
        include_tags={"button", "a", "input"},
        keywords=["search", "submit", "go", "find"],
    )


def find_clickable(candidates: list[Candidate], target: str) -> Candidate | None:
    """
    Find a clickable element matching the target text.

    Args:
        candidates: List of candidate elements to search.
        target: Text to match against (e.g., "Sign in").

    Returns:
        The best matching clickable element, or None if not found.
    """
    return best_match(
        candidates,
        include_tags={"button", "a", "input"},
        keywords=[target],
    )
```

---

## Step 7: Create Base Planner Interface

Create `app/planner/base.py` with the abstract base class:

```python
"""
Base planner interface.

Defines the abstract interface that all planner implementations must follow.
Uses the Strategy pattern to allow swapping between different planning backends.
"""

from abc import ABC, abstractmethod

from app.schemas import PlanRequest, PlanResponse


class BasePlanner(ABC):
    """
    Abstract base class for all planner implementations.

    All planners (rule-based, Anthropic, OpenAI, etc.) must inherit
    from this class and implement the plan() method.

    The plan() method is async to support non-blocking LLM API calls.

    Example implementation:
        class MyPlanner(BasePlanner):
            async def plan(self, request: PlanRequest) -> PlanResponse:
                # Generate plan
                return PlanResponse(summary="...", steps=[...])
    """

    @abstractmethod
    async def plan(self, request: PlanRequest) -> PlanResponse:
        """
        Generate an execution plan for the user's request.

        This method receives the user's goal and current page state,
        and returns a plan with steps to execute.

        Args:
            request: The plan request containing userRequest, page, etc.

        Returns:
            PlanResponse with summary and list of steps.

        Raises:
            Exception: If planning fails (will be caught by router).
        """
        ...

    def get_name(self) -> str:
        """
        Get the name of this planner.

        Returns:
            Human-readable name of the planner (e.g., "anthropic").
        """
        return self.__class__.__name__.replace("Planner", "").lower()
```

---

## Step 8: Create Rule-Based Planner Strategy

Create `app/planner/strategies/rule_based.py`:

```python
"""
Rule-based planner strategy.

A heuristic planner that uses keyword matching to generate plans.
This is the fallback planner that works without any LLM API keys.
"""

from app.planner.base import BasePlanner
from app.planner.matcher import (
    best_match,
    find_clickable,
    find_search_input,
    find_submit_button,
)
from app.schemas import PlanRequest, PlanResponse, Step


class RuleBasedPlanner(BasePlanner):
    """
    Heuristic planner using keyword matching.

    Supports the following commands:
    - "search <query>" - Types query into search box
    - "scroll down" / "go down" - Scrolls the page
    - "click <target>" - Clicks a button/link matching target

    This planner does not require any API keys and works offline.
    """

    async def plan(self, request: PlanRequest) -> PlanResponse:
        """
        Generate a plan using rule-based heuristics.

        Args:
            request: The plan request.

        Returns:
            PlanResponse with generated steps.
        """
        goal = request.userRequest.strip()
        goal_lower = goal.lower()
        page = request.page
        candidates = page.candidates

        steps: list[Step] = []

        # Handle "search <query>" pattern
        if "search" in goal_lower:
            return self._handle_search(goal, goal_lower, candidates)

        # Handle "scroll down" / "go down" pattern
        if any(k in goal_lower for k in ["scroll", "go down", "down"]):
            return self._handle_scroll()

        # Handle "click <target>" pattern
        if goal_lower.startswith("click "):
            return self._handle_click(goal, candidates)

        # No pattern matched
        return PlanResponse(
            summary="No confident automation plan. Try: 'search <term>', 'click <button text>', or 'scroll down'.",
            steps=[],
        )

    def _handle_search(
        self,
        goal: str,
        goal_lower: str,
        candidates: list,
    ) -> PlanResponse:
        """Handle search command."""
        # Extract query from goal
        idx = goal_lower.find("search")
        query = goal[idx + len("search"):].strip(" :,-") or goal

        # Find search input
        search_input = find_search_input(candidates)

        if not search_input:
            return PlanResponse(
                summary=f"Could not find a search input on this page.",
                steps=[],
            )

        steps: list[Step] = []

        # Click to focus
        steps.append(Step(
            tool="CLICK",
            selector=search_input.selector,
            note="Focus the search box",
        ))

        # Type query
        steps.append(Step(
            tool="TYPE",
            selector=search_input.selector,
            text=query,
            note=f'Type: "{query}"',
        ))

        # Try to find submit button
        submit_btn = find_submit_button(candidates)
        if submit_btn:
            steps.append(Step(
                tool="CLICK",
                selector=submit_btn.selector,
                note="Submit search",
            ))

        return PlanResponse(
            summary=f'Planned search for "{query}".',
            steps=steps,
        )

    def _handle_scroll(self) -> PlanResponse:
        """Handle scroll command."""
        return PlanResponse(
            summary="Scrolling down.",
            steps=[Step(
                tool="SCROLL",
                deltaY=900,
                note="Scroll down",
            )],
        )

    def _handle_click(self, goal: str, candidates: list) -> PlanResponse:
        """Handle click command."""
        target = goal[6:].strip()  # Remove "click " prefix

        btn = find_clickable(candidates, target)

        if not btn:
            return PlanResponse(
                summary=f'Could not find element matching "{target}".',
                steps=[],
            )

        return PlanResponse(
            summary=f'Clicking "{target}".',
            steps=[Step(
                tool="CLICK",
                selector=btn.selector,
                note=f'Click something matching "{target}"',
            )],
        )
```

---

## Step 9: Create Anthropic Planner Strategy

Create `app/planner/strategies/anthropic.py`:

```python
"""
Anthropic Claude planner strategy.

Uses Anthropic's Claude models to generate intelligent plans
based on the user's goal and page context.
"""

import json
from typing import Any

from anthropic import AsyncAnthropic

from app.config import get_settings
from app.planner.base import BasePlanner
from app.planner.prompts.system import get_planning_prompt
from app.schemas import PlanRequest, PlanResponse, Step


class AnthropicPlanner(BasePlanner):
    """
    Planner using Anthropic's Claude models.

    Sends the user's goal and page context to Claude,
    which returns a structured plan with steps to execute.

    Requires ANTHROPIC_API_KEY to be set in environment.
    """

    def __init__(self):
        """Initialize the Anthropic client."""
        settings = get_settings()
        if not settings.anthropic_api_key:
            raise ValueError("ANTHROPIC_API_KEY is required for Anthropic planner")

        self.client = AsyncAnthropic(api_key=settings.anthropic_api_key)
        self.model = settings.anthropic_model

    async def plan(self, request: PlanRequest) -> PlanResponse:
        """
        Generate a plan using Claude.

        Args:
            request: The plan request.

        Returns:
            PlanResponse with generated steps.
        """
        try:
            # Build the prompt
            system_prompt = get_planning_prompt()
            user_message = self._build_user_message(request)

            # Call Claude
            response = await self.client.messages.create(
                model=self.model,
                max_tokens=1024,
                system=system_prompt,
                messages=[
                    {"role": "user", "content": user_message}
                ],
            )

            # Parse response
            return self._parse_response(response.content[0].text)

        except Exception as e:
            return PlanResponse(
                summary=f"Anthropic planning failed: {str(e)}",
                steps=[],
                error=str(e),
            )

    def _build_user_message(self, request: PlanRequest) -> str:
        """Build the user message with context."""
        candidates_str = "\n".join([
            f"- {c.tag}: selector='{c.selector}' text='{c.text}' "
            f"aria='{c.ariaLabel}' placeholder='{c.placeholder}'"
            for c in request.page.candidates[:30]  # Limit to 30
        ])

        return f"""
User Goal: {request.userRequest}

Current Page:
- URL: {request.page.url}
- Title: {request.page.title}

Available Elements:
{candidates_str}

Generate a plan to achieve the user's goal.
"""

    def _parse_response(self, text: str) -> PlanResponse:
        """Parse Claude's response into a PlanResponse."""
        try:
            # Try to extract JSON from response
            # Claude might wrap it in markdown code blocks
            if "```json" in text:
                start = text.find("```json") + 7
                end = text.find("```", start)
                text = text[start:end].strip()
            elif "```" in text:
                start = text.find("```") + 3
                end = text.find("```", start)
                text = text[start:end].strip()

            data = json.loads(text)

            steps = [
                Step(
                    tool=s.get("tool", "CLICK"),
                    selector=s.get("selector"),
                    text=s.get("text"),
                    deltaY=s.get("deltaY"),
                    url=s.get("url"),
                    note=s.get("note"),
                )
                for s in data.get("steps", [])
            ]

            return PlanResponse(
                summary=data.get("summary", "Plan generated."),
                steps=steps,
            )

        except json.JSONDecodeError:
            # If JSON parsing fails, return error
            return PlanResponse(
                summary="Failed to parse Claude's response.",
                steps=[],
                error="Invalid JSON in response",
            )
```

---

## Step 10: Create OpenAI Planner Strategy

Create `app/planner/strategies/openai.py`:

```python
"""
OpenAI GPT planner strategy.

Uses OpenAI's GPT models to generate intelligent plans
based on the user's goal and page context.
"""

import json

from openai import AsyncOpenAI

from app.config import get_settings
from app.planner.base import BasePlanner
from app.planner.prompts.system import get_planning_prompt
from app.schemas import PlanRequest, PlanResponse, Step


class OpenAIPlanner(BasePlanner):
    """
    Planner using OpenAI's GPT models.

    Requires OPENAI_API_KEY to be set in environment.
    """

    def __init__(self):
        """Initialize the OpenAI client."""
        settings = get_settings()
        if not settings.openai_api_key:
            raise ValueError("OPENAI_API_KEY is required for OpenAI planner")

        self.client = AsyncOpenAI(api_key=settings.openai_api_key)
        self.model = settings.openai_model

    async def plan(self, request: PlanRequest) -> PlanResponse:
        """
        Generate a plan using GPT.

        Args:
            request: The plan request.

        Returns:
            PlanResponse with generated steps.
        """
        try:
            system_prompt = get_planning_prompt()
            user_message = self._build_user_message(request)

            response = await self.client.chat.completions.create(
                model=self.model,
                max_tokens=1024,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_message},
                ],
                response_format={"type": "json_object"},
            )

            return self._parse_response(response.choices[0].message.content or "")

        except Exception as e:
            return PlanResponse(
                summary=f"OpenAI planning failed: {str(e)}",
                steps=[],
                error=str(e),
            )

    def _build_user_message(self, request: PlanRequest) -> str:
        """Build the user message with context."""
        candidates_str = "\n".join([
            f"- {c.tag}: selector='{c.selector}' text='{c.text}' "
            f"aria='{c.ariaLabel}' placeholder='{c.placeholder}'"
            for c in request.page.candidates[:30]
        ])

        return f"""
User Goal: {request.userRequest}

Current Page:
- URL: {request.page.url}
- Title: {request.page.title}

Available Elements:
{candidates_str}

Generate a plan to achieve the user's goal.
"""

    def _parse_response(self, text: str) -> PlanResponse:
        """Parse GPT's response into a PlanResponse."""
        try:
            data = json.loads(text)

            steps = [
                Step(
                    tool=s.get("tool", "CLICK"),
                    selector=s.get("selector"),
                    text=s.get("text"),
                    deltaY=s.get("deltaY"),
                    url=s.get("url"),
                    note=s.get("note"),
                )
                for s in data.get("steps", [])
            ]

            return PlanResponse(
                summary=data.get("summary", "Plan generated."),
                steps=steps,
            )

        except json.JSONDecodeError:
            return PlanResponse(
                summary="Failed to parse GPT's response.",
                steps=[],
                error="Invalid JSON in response",
            )
```

---

## Step 11: Create Gemini Planner Strategy

Create `app/planner/strategies/gemini.py`:

```python
"""
Google Gemini planner strategy.

Uses Google's Gemini models to generate intelligent plans
based on the user's goal and page context.
"""

import json

import google.generativeai as genai

from app.config import get_settings
from app.planner.base import BasePlanner
from app.planner.prompts.system import get_planning_prompt
from app.schemas import PlanRequest, PlanResponse, Step


class GeminiPlanner(BasePlanner):
    """
    Planner using Google's Gemini models.

    Requires GEMINI_API_KEY to be set in environment.
    """

    def __init__(self):
        """Initialize the Gemini client."""
        settings = get_settings()
        if not settings.gemini_api_key:
            raise ValueError("GEMINI_API_KEY is required for Gemini planner")

        genai.configure(api_key=settings.gemini_api_key)
        self.model = genai.GenerativeModel(settings.gemini_model)

    async def plan(self, request: PlanRequest) -> PlanResponse:
        """
        Generate a plan using Gemini.

        Args:
            request: The plan request.

        Returns:
            PlanResponse with generated steps.
        """
        try:
            system_prompt = get_planning_prompt()
            user_message = self._build_user_message(request)

            full_prompt = f"{system_prompt}\n\n{user_message}"

            # Gemini doesn't have native async, run in executor
            response = await self._generate_async(full_prompt)

            return self._parse_response(response)

        except Exception as e:
            return PlanResponse(
                summary=f"Gemini planning failed: {str(e)}",
                steps=[],
                error=str(e),
            )

    async def _generate_async(self, prompt: str) -> str:
        """Generate content asynchronously."""
        import asyncio
        loop = asyncio.get_event_loop()
        response = await loop.run_in_executor(
            None,
            lambda: self.model.generate_content(prompt)
        )
        return response.text

    def _build_user_message(self, request: PlanRequest) -> str:
        """Build the user message with context."""
        candidates_str = "\n".join([
            f"- {c.tag}: selector='{c.selector}' text='{c.text}' "
            f"aria='{c.ariaLabel}' placeholder='{c.placeholder}'"
            for c in request.page.candidates[:30]
        ])

        return f"""
User Goal: {request.userRequest}

Current Page:
- URL: {request.page.url}
- Title: {request.page.title}

Available Elements:
{candidates_str}

Generate a plan to achieve the user's goal.
"""

    def _parse_response(self, text: str) -> PlanResponse:
        """Parse Gemini's response into a PlanResponse."""
        try:
            # Extract JSON from response
            if "```json" in text:
                start = text.find("```json") + 7
                end = text.find("```", start)
                text = text[start:end].strip()
            elif "```" in text:
                start = text.find("```") + 3
                end = text.find("```", start)
                text = text[start:end].strip()

            data = json.loads(text)

            steps = [
                Step(
                    tool=s.get("tool", "CLICK"),
                    selector=s.get("selector"),
                    text=s.get("text"),
                    deltaY=s.get("deltaY"),
                    url=s.get("url"),
                    note=s.get("note"),
                )
                for s in data.get("steps", [])
            ]

            return PlanResponse(
                summary=data.get("summary", "Plan generated."),
                steps=steps,
            )

        except json.JSONDecodeError:
            return PlanResponse(
                summary="Failed to parse Gemini's response.",
                steps=[],
                error="Invalid JSON in response",
            )
```

---

## Step 12: Create Local LLM Planner Strategy

Create `app/planner/strategies/local.py`:

```python
"""
Local LLM planner strategy.

Uses a local LLM (e.g., Ollama) to generate plans.
Useful for offline/private operation.
"""

import json

import httpx

from app.config import get_settings
from app.planner.base import BasePlanner
from app.planner.prompts.system import get_planning_prompt
from app.schemas import PlanRequest, PlanResponse, Step


class LocalPlanner(BasePlanner):
    """
    Planner using a local LLM.

    Connects to a local LLM API (e.g., Ollama) running on localhost.
    Configure LOCAL_MODEL_URL and LOCAL_MODEL_NAME in environment.
    """

    def __init__(self):
        """Initialize the local LLM client."""
        settings = get_settings()
        self.url = settings.local_model_url
        self.model = settings.local_model_name
        self.client = httpx.AsyncClient(timeout=60.0)

    async def plan(self, request: PlanRequest) -> PlanResponse:
        """
        Generate a plan using local LLM.

        Args:
            request: The plan request.

        Returns:
            PlanResponse with generated steps.
        """
        try:
            system_prompt = get_planning_prompt()
            user_message = self._build_user_message(request)

            full_prompt = f"{system_prompt}\n\n{user_message}"

            response = await self.client.post(
                self.url,
                json={
                    "model": self.model,
                    "prompt": full_prompt,
                    "stream": False,
                    "format": "json",
                },
            )
            response.raise_for_status()

            data = response.json()
            return self._parse_response(data.get("response", ""))

        except Exception as e:
            return PlanResponse(
                summary=f"Local LLM planning failed: {str(e)}",
                steps=[],
                error=str(e),
            )

    def _build_user_message(self, request: PlanRequest) -> str:
        """Build the user message with context."""
        candidates_str = "\n".join([
            f"- {c.tag}: selector='{c.selector}' text='{c.text}' "
            f"aria='{c.ariaLabel}' placeholder='{c.placeholder}'"
            for c in request.page.candidates[:30]
        ])

        return f"""
User Goal: {request.userRequest}

Current Page:
- URL: {request.page.url}
- Title: {request.page.title}

Available Elements:
{candidates_str}

Generate a plan to achieve the user's goal.
"""

    def _parse_response(self, text: str) -> PlanResponse:
        """Parse local LLM's response into a PlanResponse."""
        try:
            data = json.loads(text)

            steps = [
                Step(
                    tool=s.get("tool", "CLICK"),
                    selector=s.get("selector"),
                    text=s.get("text"),
                    deltaY=s.get("deltaY"),
                    url=s.get("url"),
                    note=s.get("note"),
                )
                for s in data.get("steps", [])
            ]

            return PlanResponse(
                summary=data.get("summary", "Plan generated."),
                steps=steps,
            )

        except json.JSONDecodeError:
            return PlanResponse(
                summary="Failed to parse local LLM's response.",
                steps=[],
                error="Invalid JSON in response",
            )
```

---

## Step 13: Create Planner Factory

Create `app/planner/factory.py`:

```python
"""
Planner factory.

Creates the appropriate planner instance based on the provider name.
Uses the Factory pattern for clean planner instantiation.
"""

from functools import lru_cache

from app.config import get_settings
from app.planner.base import BasePlanner
from app.planner.strategies.anthropic import AnthropicPlanner
from app.planner.strategies.gemini import GeminiPlanner
from app.planner.strategies.local import LocalPlanner
from app.planner.strategies.openai import OpenAIPlanner
from app.planner.strategies.rule_based import RuleBasedPlanner
from app.schemas import Provider


# Registry of available planners
PLANNER_REGISTRY: dict[Provider, type[BasePlanner]] = {
    "rule_based": RuleBasedPlanner,
    "anthropic": AnthropicPlanner,
    "openai": OpenAIPlanner,
    "gemini": GeminiPlanner,
    "local": LocalPlanner,
}


class PlannerFactory:
    """
    Factory for creating planner instances.

    Caches planner instances to avoid repeated initialization.
    """

    def __init__(self):
        """Initialize the factory with an empty cache."""
        self._cache: dict[Provider, BasePlanner] = {}

    def get_planner(self, provider: Provider) -> BasePlanner:
        """
        Get or create a planner for the given provider.

        Args:
            provider: The provider name.

        Returns:
            A BasePlanner instance for the provider.

        Raises:
            ValueError: If the provider is not supported.
        """
        # Return cached instance if available
        if provider in self._cache:
            return self._cache[provider]

        # Get planner class from registry
        planner_class = PLANNER_REGISTRY.get(provider)
        if not planner_class:
            raise ValueError(f"Unknown provider: {provider}")

        # Create and cache instance
        planner = planner_class()
        self._cache[provider] = planner

        return planner

    def clear_cache(self):
        """Clear the planner cache."""
        self._cache.clear()


# Global factory instance
_factory: PlannerFactory | None = None


def get_factory() -> PlannerFactory:
    """Get the global planner factory instance."""
    global _factory
    if _factory is None:
        _factory = PlannerFactory()
    return _factory


def create_planner(provider: Provider | None = None) -> BasePlanner:
    """
    Create a planner for the given provider.

    If provider is None, uses the default from settings.

    Args:
        provider: The provider name, or None for default.

    Returns:
        A BasePlanner instance.
    """
    if provider is None:
        provider = get_settings().default_provider

    return get_factory().get_planner(provider)
```

---

## Step 14: Create System Prompts

Create `app/planner/prompts/__init__.py`:

```python
"""Prompt templates for LLM planners."""
```

Create `app/planner/prompts/system.py`:

```python
"""
System prompts for LLM planners.

Contains the shared system prompt used by all LLM-based planners
to ensure consistent output format.
"""


def get_planning_prompt() -> str:
    """
    Get the system prompt for planning.

    Returns:
        The system prompt string.
    """
    return """You are a browser automation assistant. Your job is to analyze a user's goal and the current page state, then generate a plan of actions to achieve that goal.

## Available Tools

You can use these tools:
- CLICK: Click on an element. Requires "selector".
- TYPE: Type text into an element. Requires "selector" and "text".
- SCROLL: Scroll the page. Requires "deltaY" (positive = down, negative = up).
- NAVIGATE: Navigate to a URL. Requires "url".

## Output Format

You MUST respond with valid JSON in this exact format:
{
    "summary": "Brief description of what the plan will do",
    "steps": [
        {
            "tool": "CLICK" | "TYPE" | "SCROLL" | "NAVIGATE",
            "selector": "CSS selector (for CLICK/TYPE)",
            "text": "text to type (for TYPE)",
            "deltaY": 500 (for SCROLL),
            "url": "https://..." (for NAVIGATE),
            "note": "Human-readable explanation"
        }
    ]
}

## Guidelines

1. Use the most specific selector available (prefer ID > name > aria-label > CSS path)
2. Include a helpful "note" for each step explaining what it does
3. Keep plans minimal - only include necessary steps
4. If the goal cannot be achieved with the available elements, return an empty steps array and explain in summary
5. Never generate steps for login, payment, or sensitive actions
6. Respond ONLY with the JSON object, no additional text

## Example

User goal: "search for cats"
Page has: input[name="q"], button[aria-label="Search"]

Response:
{
    "summary": "Searching for 'cats'",
    "steps": [
        {"tool": "CLICK", "selector": "input[name=\"q\"]", "note": "Focus search input"},
        {"tool": "TYPE", "selector": "input[name=\"q\"]", "text": "cats", "note": "Type search query"},
        {"tool": "CLICK", "selector": "button[aria-label=\"Search\"]", "note": "Submit search"}
    ]
}
"""
```

---

## Step 15: Create FastAPI Dependencies

Create `app/dependencies.py`:

```python
"""
FastAPI dependency injection.

Provides dependencies for routes to inject settings, planners, etc.
"""

from fastapi import Depends, Request

from app.config import Settings, get_settings
from app.planner.base import BasePlanner
from app.planner.factory import create_planner
from app.schemas import PlanRequest, Provider


async def get_planner_for_request(
    request: PlanRequest,
    settings: Settings = Depends(get_settings),
) -> BasePlanner:
    """
    Get the appropriate planner for a request.

    Uses the provider specified in the request, or falls back
    to the default provider from settings.

    Args:
        request: The plan request (contains optional provider override).
        settings: Application settings.

    Returns:
        A BasePlanner instance.
    """
    provider = request.provider or settings.default_provider
    return create_planner(provider)
```

---

## Step 16: Create Plan Router

Create `app/routers/__init__.py`:

```python
"""API routers."""
```

Create `app/routers/plan.py`:

```python
"""
Plan router.

Handles the POST /plan endpoint for generating execution plans.
"""

from fastapi import APIRouter, Depends, HTTPException

from app.config import Settings, get_settings
from app.planner.base import BasePlanner
from app.planner.factory import create_planner
from app.schemas import PlanRequest, PlanResponse

router = APIRouter(tags=["planning"])


@router.post("/plan", response_model=PlanResponse)
async def create_plan(
    request: PlanRequest,
    settings: Settings = Depends(get_settings),
) -> PlanResponse:
    """
    Generate an execution plan for the user's request.

    Takes a user goal and current page state, and returns a plan
    with steps to execute.

    The provider can be specified in the request body to override
    the default. If not specified, uses the default from settings.

    Args:
        request: The plan request with goal and page state.
        settings: Application settings (injected).

    Returns:
        PlanResponse with summary and steps.

    Raises:
        HTTPException: If provider is invalid or planning fails.
    """
    # Determine provider
    provider = request.provider or settings.default_provider

    try:
        # Get planner
        planner = create_planner(provider)

        # Generate plan
        response = await planner.plan(request)

        return response

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Planning failed: {str(e)}")


@router.get("/providers")
async def list_providers(
    settings: Settings = Depends(get_settings),
) -> dict:
    """
    List available providers.

    Returns:
        Dict with available providers and current default.
    """
    return {
        "providers": ["rule_based", "anthropic", "openai", "gemini", "local"],
        "default": settings.default_provider,
    }
```

---

## Step 17: Create Main Application

Create `app/main.py`:

```python
"""
FastAPI application entry point.

Creates and configures the FastAPI app with middleware,
routers, and lifecycle management.
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routers import plan


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan context manager.

    Runs setup code before the app starts accepting requests,
    and cleanup code after the app stops.
    """
    # Startup
    settings = get_settings()
    print(f"Starting Zen Tab Agent Server v0.2.0")
    print(f"Default provider: {settings.default_provider}")
    print(f"Debug mode: {settings.debug}")

    yield

    # Shutdown
    print("Shutting down...")


def create_app() -> FastAPI:
    """
    Create and configure the FastAPI application.

    Returns:
        Configured FastAPI app instance.
    """
    settings = get_settings()

    app = FastAPI(
        title="Zen Tab Agent Server",
        description="AI-powered browser automation planner",
        version="0.2.0",
        lifespan=lifespan,
    )

    # Add CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=settings.cors_allow_credentials,
        allow_methods=settings.cors_allow_methods,
        allow_headers=settings.cors_allow_headers,
    )

    # Include routers
    app.include_router(plan.router)

    # Health check endpoint
    @app.get("/health")
    async def health_check():
        """Health check endpoint."""
        return {"status": "healthy", "version": "0.2.0"}

    return app


# Create app instance
app = create_app()
```

---

## Step 18: Create Entry Point

Create `run.py` in the `agent_server` root:

```python
"""
Application entry point.

Run with: python run.py
Or: uvicorn app.main:app --reload
"""

import uvicorn

from app.config import get_settings


def main():
    """Run the application."""
    settings = get_settings()

    uvicorn.run(
        "app.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.reload,
    )


if __name__ == "__main__":
    main()
```

---

## Step 19: Update Requirements

Update `requirements.txt`:

```txt
# Web Framework
fastapi==0.115.6
uvicorn[standard]==0.34.0

# Data Validation
pydantic==2.10.4
pydantic-settings>=2.0.0

# Environment
python-dotenv>=1.0.0

# HTTP Client (for local LLM)
httpx>=0.27.0

# LLM Providers
anthropic>=0.40.0
openai>=1.50.0
google-generativeai>=0.8.0

# Development/Testing
pytest>=8.0.0
pytest-asyncio>=0.24.0
```

Install the new dependencies:

```bash
pip install -r requirements.txt
```

---

## Step 20: Create Environment Template

Create `.env.example`:

```bash
# ===========================================
# Zen Tab Agent Server Configuration
# ===========================================
# Copy this file to .env and fill in your values

# ===========================================
# LLM Provider API Keys
# ===========================================
# At least one is required if not using rule_based

ANTHROPIC_API_KEY=
OPENAI_API_KEY=
GEMINI_API_KEY=

# ===========================================
# Default Provider
# ===========================================
# Options: rule_based, anthropic, openai, gemini, local

DEFAULT_PROVIDER=rule_based

# ===========================================
# Model Configuration
# ===========================================

ANTHROPIC_MODEL=claude-sonnet-4-20250514
OPENAI_MODEL=gpt-4o
GEMINI_MODEL=gemini-1.5-pro

# Local LLM (Ollama)
LOCAL_MODEL_URL=http://localhost:11434/api/generate
LOCAL_MODEL_NAME=llama3

# ===========================================
# Server Configuration
# ===========================================

HOST=127.0.0.1
PORT=8765
DEBUG=false
RELOAD=false

# ===========================================
# CORS Configuration
# ===========================================
# For production, set specific origins

CORS_ORIGINS=["*"]
```

Create your actual `.env` file:

```bash
cp .env.example .env
# Edit .env with your API keys
```

---

## Step 21: Create Test Configuration

Create `tests/conftest.py`:

```python
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
```

Create `tests/test_api.py`:

```python
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
```

Create `tests/test_matcher.py`:

```python
"""
Matcher function tests.
"""

import pytest

from app.planner.matcher import best_match, find_search_input
from app.schemas import Candidate


def test_best_match_finds_input():
    """Test that best_match finds matching input."""
    candidates = [
        Candidate(
            selector="input[name='q']",
            tag="input",
            placeholder="Search",
            text="",
            ariaLabel="",
            name="q",
            type="text",
            href="",
        ),
    ]

    result = best_match(candidates, {"input"}, ["search"])

    assert result is not None
    assert result.selector == "input[name='q']"


def test_best_match_returns_none_when_no_match():
    """Test that best_match returns None when no match."""
    candidates = [
        Candidate(
            selector="button",
            tag="button",
            text="Submit",
            ariaLabel="",
            placeholder="",
            name="",
            type="",
            href="",
        ),
    ]

    result = best_match(candidates, {"input"}, ["search"])

    assert result is None


def test_find_search_input():
    """Test find_search_input convenience function."""
    candidates = [
        Candidate(
            selector="input[name='q']",
            tag="input",
            placeholder="Search Google",
            text="",
            ariaLabel="",
            name="q",
            type="text",
            href="",
        ),
    ]

    result = find_search_input(candidates)

    assert result is not None
    assert result.selector == "input[name='q']"
```

---

## Step 22: Clean Up Old Files

After verifying the new structure works:

```bash
# Test the new structure
python run.py  # Should start the server

# In another terminal, test the endpoint
curl http://127.0.0.1:8765/health
curl http://127.0.0.1:8765/providers

# Run tests
pytest tests/ -v

# If everything works, remove the old file
rm app.py
```

---

## Running the Server

### Development Mode

```bash
cd agent_server
source .venv/bin/activate

# Option 1: Using run.py
python run.py

# Option 2: Using uvicorn directly with reload
uvicorn app.main:app --host 127.0.0.1 --port 8765 --reload
```

### Production Mode

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8765 --workers 4
```

---

## Testing

Run all tests:

```bash
pytest tests/ -v
```

Run specific test file:

```bash
pytest tests/test_matcher.py -v
```

Run with coverage:

```bash
pytest tests/ --cov=app --cov-report=html
```

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/providers` | List available providers |
| POST | `/plan` | Generate execution plan |

### Example Request

```bash
curl -X POST http://127.0.0.1:8765/plan \
  -H "Content-Type: application/json" \
  -d '{
    "userRequest": "search for machine learning",
    "page": {
      "url": "https://google.com",
      "title": "Google",
      "text": "",
      "candidates": [
        {"selector": "input[name=q]", "tag": "input", "placeholder": "Search"}
      ]
    },
    "provider": "anthropic"
  }'
```

### Example Response

```json
{
  "summary": "Searching for 'machine learning'",
  "steps": [
    {
      "tool": "CLICK",
      "selector": "input[name=q]",
      "note": "Focus search input"
    },
    {
      "tool": "TYPE",
      "selector": "input[name=q]",
      "text": "machine learning",
      "note": "Type search query"
    }
  ]
}
```
