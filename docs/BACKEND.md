# Backend Structure

FastAPI server providing browser automation planning via `/plan` endpoint.

## Directory Layout

```
agent_server/
├── app/
│   ├── main.py          # FastAPI app creation, CORS, lifespan
│   ├── config.py        # Pydantic settings from env vars
│   ├── dependencies.py  # Shared dependencies (unused)
│   ├── planner/         # Planning system
│   │   ├── base.py      # BasePlanner abstract class
│   │   ├── factory.py   # PlannerFactory for provider selection
│   │   ├── matcher.py   # Element matching utilities
│   │   └── strategies/  # Planner implementations
│   │       ├── rule_based.py  # Keyword-based heuristics
│   │       ├── anthropic.py   # Claude API
│   │       ├── openai.py      # GPT API
│   │       ├── gemini.py      # Gemini API
│   │       └── local.py       # Local LLM
│   ├── routers/
│   │   └── plan.py      # /plan endpoint, /providers endpoint
│   └── schemas/         # Pydantic models
│       ├── requests.py  # PlanRequest, PageSnapshot, Candidate
│       └── responses.py # PlanResponse, Step
├── tests/               # Pytest tests
├── requirements.txt     # Python dependencies
└── run.py               # Uvicorn entry point
```

# Data Flow with Example

## Example: User types "search for cats"

### 1. HTTP Request → FastAPI
**Input**: POST `/plan` with JSON:
```json
{
  "userRequest": "search for cats",
  "page": {
    "url": "https://google.com",
    "title": "Google",
    "text": "About 1,240,000,000 results...",
    "candidates": [
      {"selector": "#search-input", "tag": "input", "placeholder": "Search Google"},
      {"selector": "#search-btn", "tag": "button", "text": "Google Search"}
    ]
  }
}
```

### 2. Router Processing
**Function**: `routers/plan.create_plan(request, settings)`

- Extracts `provider` from request (or uses `settings.default_provider = "rule_based"`)
- Calls `factory.create_planner("rule_based")`
- Catches exceptions, returns HTTP 400/500 if planning fails

### 3. Factory Creation
**Function**: `factory.create_planner(provider)`

- Gets singleton `PlannerFactory` via `get_factory()`
- Calls `factory.get_planner("rule_based")`
- Returns cached `RuleBasedPlanner` instance (or creates new)

### 4. Rule-Based Planning
**Function**: `RuleBasedPlanner.plan(request)`

- Parses `goal = "search for cats"`
- Detects `"search" in goal_lower`, calls `self._handle_search()`

**Function**: `RuleBasedPlanner._handle_search(goal, goal_lower, candidates)`

- Extracts `query = "for cats"` → `"cats"`
- Calls `matcher.find_search_input(candidates)`
- Calls `matcher.find_submit_button(candidates)`
- Returns `PlanResponse` with steps

### 5. Element Matching
**Function**: `matcher.find_search_input(candidates)`

- Calls `best_match(candidates, {"input", "textarea"}, ["search", "q", "query", "find"])`
- Scores each candidate by keyword matches in text/placeholder/ariaLabel
- Returns best matching `Candidate` (e.g., `{"selector": "#search-input", ...}`)

**Function**: `matcher.best_match(candidates, include_tags, keywords)`

- Filters candidates by tag (`candidate.tag.lower() in include_tags`)
- Builds `haystack` from all text fields, converts to lowercase
- Scores: +2 per keyword match, +1 for ariaLabel/placeholder/text presence
- Returns highest scoring candidate

### 6. Response Generation
**Output**: `PlanResponse` JSON:
```json
{
  "summary": "Planned search for \"cats\".",
  "steps": [
    {
      "tool": "CLICK",
      "selector": "#search-input",
      "note": "Focus the search box"
    },
    {
      "tool": "TYPE",
      "selector": "#search-input",
      "text": "cats",
      "note": "Type: \"cats\""
    },
    {
      "tool": "CLICK",
      "selector": "#search-btn",
      "note": "Submit search"
    }
  ]
}
```

## Key Function Relationships

### Entry Points
- `run.py: main()` → loads `config.get_settings()`, starts uvicorn with `"app.main:app"`
- `main.py: create_app()` → `FastAPI()` + CORS + `app.include_router(plan.router)` + health endpoint

### API Layer
- `routers/plan.py: create_plan(request: PlanRequest, settings: Settings)` → validates provider, calls `create_planner()`, calls `planner.plan()`, returns `PlanResponse`

### Planning Strategies
- **Rule-based**: `strategies/rule_based.py: RuleBasedPlanner.plan(request: PlanRequest)` → pattern matching on `request.userRequest`, calls matcher functions, returns structured steps
- **AI-based**: `strategies/anthropic.py: AnthropicPlanner.plan(request: PlanRequest)` → builds prompt with `prompts.system.get_planning_prompt()`, calls Claude API, parses JSON response

### Core Utilities
- `matcher.py: best_match(candidates: list[Candidate], include_tags: set[str], keywords: list[str])` → scores candidates by relevance, returns best match or None
- `matcher.py: find_search_input(candidates)` → `best_match(..., tags={"input","textarea"}, keywords=["search","q","query"])` for search boxes
- `matcher.py: find_clickable(candidates, target)` → `best_match(..., tags={"button","a","input"}, keywords=[target])` for clickable elements

### Configuration
- `config.py: get_settings()` → `@lru_cache` loads `Settings` from env vars + `.env` file
- `factory.py: get_factory()` → singleton `PlannerFactory` with `PLANNER_REGISTRY` mapping providers to classes