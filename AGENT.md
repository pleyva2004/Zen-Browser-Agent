# Zen Tab Agent - Implementation Guide for Coding Agents

You are implementing enhancements to Zen Tab Agent, a browser automation sidebar for Zen Browser. This document contains everything you need to know about the current state and what to build.

---

## Project Overview

**Goal:** Add RAG chat mode + screenshot capture + semantic element search to achieve feature parity with Claude in Chrome.

**Tech Stack:**
- Backend: FastAPI + Pydantic (Python 3.9+)
- Frontend: React 18 + TypeScript + Vite
- Extension: WebExtension APIs (Firefox/Zen compatible)

---

## Current Architecture

```
User Input → POST /plan → PlanResponse { summary, steps[] } → Execute in browser
```

**Target Architecture:**
```
User Input → Intent Classifier
                    │
         ┌──────────┴──────────┐
         ▼                     ▼
    CHAT MODE              ACTION MODE
         │                     │
    POST /chat             POST /plan
         │                     │
    ChatResponse           PlanResponse
    { response }           { steps[] }
```

---

## What's Already Implemented

### Schemas (`agent_server/app/schemas/`)

**requests.py:**
```python
Provider = Literal["rule_based", "anthropic", "openai", "gemini", "local"]

class Candidate(BaseModel):
    selector: str       # CSS selector
    tag: str           # HTML tag (button, input, a, etc.)
    text: str          # Visible text (max 80 chars)
    ariaLabel: str     # ARIA label
    placeholder: str   # Input placeholder
    name: str          # Name attribute
    type: str          # Type attribute
    href: str          # Link href

class PageSnapshot(BaseModel):
    url: str
    title: str
    text: str          # Page text (~40k chars max)
    candidates: List[Candidate] = []

class PlanRequest(BaseModel):
    userRequest: str
    page: PageSnapshot
    screenshotDataUrl: Optional[str] = None  # EXISTS but unused
    provider: Optional[Provider] = None
```

**responses.py:**
```python
Tool = Literal["CLICK", "TYPE", "SCROLL", "NAVIGATE"]

class Step(BaseModel):
    tool: Tool
    selector: Optional[str] = None
    text: Optional[str] = None
    deltaY: Optional[int] = None
    url: Optional[str] = None
    note: Optional[str] = None

class PlanResponse(BaseModel):
    summary: str
    steps: List[Step]
    error: Optional[str] = None
```

### Planners (`agent_server/app/planner/`)

**Already implemented:**
- `base.py` - Abstract `BasePlanner` with `async def plan(request) -> PlanResponse`
- `factory.py` - `PlannerFactory` creates planners by provider name
- `matcher.py` - Keyword-based `best_match()`, `find_search_input()`, `find_clickable()`
- `prompts/system.py` - Shared planning prompt for LLM providers
- `strategies/rule_based.py` - Pattern matching (search, scroll, click)
- `strategies/anthropic.py` - Claude integration
- `strategies/openai.py` - GPT with JSON mode
- `strategies/gemini.py` - Google Gemini
- `strategies/local.py` - Local LLM (has vision code but DISABLED)

### Endpoints (`agent_server/app/routers/plan.py`)

```python
POST /plan          # Main planning endpoint
GET  /providers     # List available providers
POST /test-provider # Test provider connectivity
GET  /health        # Basic health check
GET  /health/detailed # Provider status
```

---

## What You Need to Build

### Phase 1: RAG Chat Mode (Priority: HIGH)

#### 1.1 Add New Schemas

**File:** `agent_server/app/schemas/requests.py`

Add:
```python
class ChatRequest(BaseModel):
    """Request for conversational Q&A about page content."""
    user_message: str
    page: PageSnapshot  # Reuse existing, will enhance later
    provider: Optional[Provider] = None

# Enhance PageSnapshot (add these fields):
class PageSnapshot(BaseModel):
    url: str
    title: str
    text: str
    candidates: List[Candidate] = []
    # NEW FIELDS:
    full_text: Optional[str] = None      # Complete page text (no truncation)
    structured_content: Optional[dict] = None  # Headers, paragraphs hierarchy
    metadata: Optional[dict] = None       # Description, keywords, author
```

**File:** `agent_server/app/schemas/responses.py`

Add:
```python
class ChatResponse(BaseModel):
    """Conversational response about page content."""
    response: str
    sources: List[str] = []  # Relevant page sections used
    error: Optional[str] = None
```

**File:** `agent_server/app/schemas/__init__.py`

Update exports:
```python
from app.schemas.requests import ChatRequest  # ADD
from app.schemas.responses import ChatResponse  # ADD
```

#### 1.2 Create Intent Classifier

**File:** `agent_server/app/planner/intent.py` (NEW FILE)

```python
"""Intent classification for routing user input."""

from typing import Literal

IntentType = Literal["chat", "action"]

# Action keywords trigger ACTION mode
ACTION_KEYWORDS = [
    "click", "tap", "press", "select",
    "type", "enter", "fill", "input",
    "scroll", "go down", "go up",
    "navigate", "go to", "open", "visit",
    "search for", "find and click",
]

# Chat keywords trigger CHAT mode
CHAT_KEYWORDS = [
    "what", "why", "how", "when", "where", "who",
    "explain", "describe", "summarize", "tell me",
    "is there", "are there", "does", "do",
    "can you", "help me understand",
]

def classify_intent(user_message: str) -> IntentType:
    """
    Classify user intent as 'chat' (Q&A) or 'action' (browser automation).

    Returns 'action' if message contains action keywords.
    Returns 'chat' if message contains question words or chat keywords.
    Defaults to 'action' if ambiguous.
    """
    message_lower = user_message.lower().strip()

    # Check for action keywords first (higher priority)
    for keyword in ACTION_KEYWORDS:
        if keyword in message_lower:
            return "action"

    # Check for chat keywords
    for keyword in CHAT_KEYWORDS:
        if message_lower.startswith(keyword) or f" {keyword}" in message_lower:
            return "chat"

    # Default to action for imperative sentences
    return "action"
```

#### 1.3 Create Chat Planner

**File:** `agent_server/app/planner/strategies/chat.py` (NEW FILE)

```python
"""Chat planner for RAG-style conversational responses."""

from app.config import get_settings
from app.schemas.requests import ChatRequest
from app.schemas.responses import ChatResponse

# Import the LLM client you want to use (example: Anthropic)
from anthropic import AsyncAnthropic


def get_chat_prompt() -> str:
    """System prompt for conversational responses."""
    return """You are a helpful assistant that answers questions about web pages.

You have access to the current page's content. Use this information to answer the user's question.

Guidelines:
- Be concise and direct
- If the answer is on the page, cite the relevant section
- If the answer is NOT on the page, say so clearly
- Do not make up information not present on the page
- Format responses in markdown if helpful

Page content will be provided in the user message."""


class ChatPlanner:
    """Generates conversational responses using page content as context."""

    def __init__(self):
        settings = get_settings()
        self.client = AsyncAnthropic(api_key=settings.anthropic_api_key)
        self.model = settings.anthropic_model

    async def chat(self, request: ChatRequest) -> ChatResponse:
        """Generate a conversational response about page content."""
        try:
            # Build context from page
            page_context = self._build_context(request.page)

            # Call LLM
            response = await self.client.messages.create(
                model=self.model,
                max_tokens=1024,
                system=get_chat_prompt(),
                messages=[
                    {
                        "role": "user",
                        "content": f"""Page URL: {request.page.url}
Page Title: {request.page.title}

Page Content:
{page_context}

---

User Question: {request.user_message}"""
                    }
                ]
            )

            return ChatResponse(
                response=response.content[0].text,
                sources=[request.page.url]
            )

        except Exception as e:
            return ChatResponse(
                response="",
                error=f"Chat failed: {str(e)}"
            )

    def _build_context(self, page) -> str:
        """Build page context for the LLM."""
        # Use full_text if available, otherwise fall back to text
        if page.full_text:
            return page.full_text[:30000]  # Limit to ~30k chars
        return page.text[:30000]
```

#### 1.4 Add Chat Endpoint

**File:** `agent_server/app/routers/plan.py`

Add to imports:
```python
from app.schemas.requests import ChatRequest
from app.schemas.responses import ChatResponse
from app.planner.strategies.chat import ChatPlanner
from app.planner.intent import classify_intent
```

Add new endpoint:
```python
@router.post("/chat", response_model=ChatResponse)
async def chat_with_page(request: ChatRequest) -> ChatResponse:
    """
    Generate a conversational response about the current page.

    This endpoint is for Q&A about page content, not browser automation.
    """
    settings = get_settings()

    if settings.debug:
        print(f"[CHAT] User: {request.user_message[:100]}...")
        print(f"[CHAT] Page: {request.page.url}")

    try:
        planner = ChatPlanner()
        response = await planner.chat(request)
        return response
    except Exception as e:
        return ChatResponse(
            response="",
            error=f"Chat failed: {str(e)}"
        )
```

---

### Phase 2: Enable Screenshot/Vision (Priority: MEDIUM)

**File:** `agent_server/app/planner/strategies/local.py`

Find this code around line 139:
```python
if request.screenshotDataUrl and False:  # DISABLED
```

Change to:
```python
if request.screenshotDataUrl:  # ENABLED
```

This enables the existing vision model flow in the local planner.

---

### Phase 3: Semantic Element Search (Priority: MEDIUM)

**File:** `agent_server/app/planner/matcher.py`

Add new class:
```python
class SemanticMatcher:
    """Use LLM to match user intent to page elements."""

    def __init__(self, client, model: str):
        self.client = client
        self.model = model

    async def find_element(
        self,
        query: str,
        candidates: list,
        page_context: str = ""
    ):
        """
        Find the best matching element using LLM reasoning.

        Args:
            query: User's description (e.g., "login button")
            candidates: List of Candidate objects
            page_context: Optional surrounding context

        Returns:
            Best matching Candidate or None
        """
        if not candidates:
            return None

        # Build prompt with candidate options
        candidate_descriptions = []
        for i, c in enumerate(candidates[:20]):  # Limit to 20
            desc = f"{i+1}. [{c.tag}] text='{c.text}' aria='{c.ariaLabel}' selector='{c.selector}'"
            candidate_descriptions.append(desc)

        prompt = f"""Find the element that best matches: "{query}"

Available elements:
{chr(10).join(candidate_descriptions)}

Respond with ONLY the number (1-{len(candidate_descriptions)}) of the best match, or 0 if none match."""

        # Call LLM (implement based on your provider)
        # Parse response to get index
        # Return candidates[index - 1] or None
```

**File:** `agent_server/app/schemas/requests.py`

Enhance Candidate:
```python
class Candidate(BaseModel):
    selector: str
    tag: str
    text: str = ""
    ariaLabel: str = ""
    placeholder: str = ""
    name: str = ""
    type: str = ""
    href: str = ""
    # NEW FIELDS for semantic matching:
    role: str = ""           # ARIA role
    context: str = ""        # Surrounding text
    location: str = ""       # Page region (header, main, footer)
    attributes: dict = {}    # Additional attributes
```

---

## File Change Summary

| File | Action | Priority |
|------|--------|----------|
| `agent_server/app/schemas/requests.py` | MODIFY - Add ChatRequest, enhance PageSnapshot & Candidate | HIGH |
| `agent_server/app/schemas/responses.py` | MODIFY - Add ChatResponse | HIGH |
| `agent_server/app/schemas/__init__.py` | MODIFY - Export new schemas | HIGH |
| `agent_server/app/planner/intent.py` | CREATE - Intent classifier | HIGH |
| `agent_server/app/planner/strategies/chat.py` | CREATE - ChatPlanner | HIGH |
| `agent_server/app/routers/plan.py` | MODIFY - Add /chat endpoint | HIGH |
| `agent_server/app/planner/strategies/local.py` | MODIFY - Enable vision | MEDIUM |
| `agent_server/app/planner/matcher.py` | MODIFY - Add SemanticMatcher | MEDIUM |

---

## Code Patterns to Follow

### 1. Schema Pattern
```python
class MyRequest(BaseModel):
    """Docstring explaining purpose."""
    required_field: str
    optional_field: Optional[str] = None
```

### 2. Planner Pattern
```python
class MyPlanner:
    def __init__(self):
        settings = get_settings()
        self.client = ...

    async def plan(self, request: PlanRequest) -> PlanResponse:
        try:
            # Implementation
            return PlanResponse(summary="...", steps=[...])
        except Exception as e:
            return PlanResponse(summary="", steps=[], error=str(e))
```

### 3. Endpoint Pattern
```python
@router.post("/endpoint", response_model=ResponseModel)
async def endpoint_name(request: RequestModel) -> ResponseModel:
    """Docstring."""
    settings = get_settings()
    if settings.debug:
        print(f"[DEBUG] ...")

    try:
        # Implementation
        return ResponseModel(...)
    except Exception as e:
        return ResponseModel(error=str(e))
```

---

## Verification Steps

### After Phase 1 (RAG Chat):
```bash
# Start server
cd agent_server && source .venv/bin/activate
uvicorn app.main:app --host 127.0.0.1 --port 8765 --reload

# Test chat endpoint
curl -X POST http://127.0.0.1:8765/chat \
  -H "Content-Type: application/json" \
  -d '{
    "user_message": "What is this page about?",
    "page": {
      "url": "https://example.com",
      "title": "Example",
      "text": "This is an example page about widgets."
    }
  }'

# Expected: {"response": "This page is about...", "sources": [...]}
```

### After Phase 2 (Vision):
```bash
# Test with screenshot (base64 encoded image)
curl -X POST http://127.0.0.1:8765/plan \
  -H "Content-Type: application/json" \
  -d '{
    "userRequest": "Click the blue button",
    "page": {...},
    "screenshotDataUrl": "data:image/png;base64,...",
    "provider": "local"
  }'
```

### After Phase 3 (Semantic Search):
```bash
# Test semantic matching
# "login button" should match element with text "Sign In"
curl -X POST http://127.0.0.1:8765/plan \
  -H "Content-Type: application/json" \
  -d '{
    "userRequest": "click the login button",
    "page": {
      "url": "https://example.com",
      "title": "Example",
      "text": "Welcome",
      "candidates": [
        {"selector": "#btn1", "tag": "button", "text": "Sign In", ...}
      ]
    }
  }'

# Expected: Step with selector "#btn1" (matched "login" to "Sign In")
```

---

## Environment Variables

Ensure `.env` has:
```
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=...
DEFAULT_PROVIDER=anthropic
DEBUG=true
```

---

## Don't Forget

1. Update `__init__.py` files when adding new modules
2. Add type hints to all functions
3. Include docstrings
4. Handle errors gracefully (return error in response, don't crash)
5. Test with `pytest` if tests exist
