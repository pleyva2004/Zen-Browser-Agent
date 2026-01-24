# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Zen-Browser-Agent is a tab-only browser automation agent for Zen Browser (Firefox-family). The agent lives in a right-side sidebar panel and can observe and act inside the currently active tab using DOM text, candidate controls, and optional visible-tab screenshots.

## Tech Stack

| Component | Technology |
|-----------|------------|
| Sidebar UI | React 18 + TypeScript + Vite |
| Background/Content Scripts | Vanilla JS (WebExtension APIs) |
| Agent Server | FastAPI + Pydantic |
| LLM Providers | Anthropic, OpenAI, Gemini, Local LLM, Rule-based |
| Build Tool | Vite |

## Architecture

```
[Zen Sidebar UI]  <->  [Background Orchestrator]  <->  [Content Script in Tab]
  (React + TS)                  |                           |
       |                        |                           +-- Click / Type / Scroll / Extract
       |                        |
       |                        +-- HTTP (localhost) -->  [FastAPI Agent Server]
                                                          (returns JSON tool plan)
                                                          |
                                                          +-- Provider Strategies
                                                              (anthropic/openai/gemini/local/rule_based)
```

### Component Responsibilities

- **Sidebar (UI):** React + TypeScript app with chat input, plan viewer, provider selector, step-by-step execution via "Run next" button
- **Background script:** Collects observations (EXTRACT + screenshot), calls agent server, executes plan steps, enforces safety gating
- **Content script:** Performs DOM interactions (EXTRACT, CLICK, TYPE, SCROLL)
- **FastAPI server:** Given user request + page snapshot, returns JSON plan with tool steps. Supports multiple LLM providers with automatic fallback to rule-based planner.

## Repository Layout

```
agent_server/               # FastAPI planner (modular structure)
  app/
    main.py                 # FastAPI app creation + health endpoints
    config.py               # Pydantic Settings (env vars, API keys)
    dependencies.py         # FastAPI dependencies
    routers/
      plan.py               # POST /plan, GET /providers, POST /test-provider
    schemas/
      requests.py           # PlanRequest, PageSnapshot, Candidate
      responses.py          # PlanResponse, Step, Tool types
    planner/
      base.py               # Abstract BasePlanner class
      factory.py            # Factory pattern for planner creation
      matcher.py            # Candidate matching logic
      prompts/
        system.py           # System prompts for LLM planners
      strategies/
        rule_based.py       # Rule-based planner (no API needed)
        anthropic.py        # Claude/Anthropic planner
        openai.py           # GPT/OpenAI planner
        gemini.py           # Google Gemini planner
        local.py            # Local LLM planner
  tests/                    # Pytest test suite
  requirements.txt
  .env                      # Environment variables (API keys)

zen_extension/              # Zen/Firefox WebExtension
  src/
    sidebar/
      main.tsx              # React entry point
      App.tsx               # Root component
      components/
        Header.tsx
        Chat.tsx
        ChatMessage.tsx
        Composer.tsx
        PlanViewer.tsx
        StepItem.tsx
        ProviderSelector.tsx
      hooks/
        useAgent.ts         # Main agent communication hook
        useBrowserRuntime.ts
      types/                # TypeScript interfaces
  dist/                     # Vite build output
  manifest.json
  background.js             # orchestrator + safety + step runner
  contentScript.js          # tab tools: EXTRACT/CLICK/TYPE/SCROLL
  vite.config.ts
  tsconfig.json
  package.json

docs/                       # Documentation
  BACKEND.md
  FRONTEND.md
  CODEBASE.md
  PRD.md

start_agent.sh              # Quick start script for backend
```

## Development Commands

### Agent Server
```bash
# Quick start (recommended)
./start_agent.sh

# Manual setup
cd agent_server
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 127.0.0.1 --port 8765 --reload
```

### Extension (React Sidebar)
```bash
cd zen_extension
npm install
npm run dev      # Watch mode (rebuilds on changes)
npm run build    # Production build
npm run typecheck
```

### Extension Loading
1. In Zen Browser, open `about:debugging`
2. Click "Load Temporary Add-on"
3. Select `zen_extension/manifest.json`
4. After code changes, click "Reload" on the extension

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/plan` | POST | Generate execution plan for user request |
| `/providers` | GET | List available LLM providers |
| `/test-provider` | POST | Test a provider's connectivity |
| `/health` | GET | Basic health check |
| `/health/detailed` | GET | Health check with provider status |

## Provider System

The agent server supports 5 planning strategies:

| Provider | Description |
|----------|-------------|
| `rule_based` | Pattern matching, no API key required |
| `anthropic` | Claude models (requires ANTHROPIC_API_KEY) |
| `openai` | GPT models (requires OPENAI_API_KEY) |
| `gemini` | Google Gemini (requires GEMINI_API_KEY) |
| `local` | Local LLM via OpenAI-compatible API |

If an LLM provider fails, the system automatically falls back to `rule_based`.

## Data Flow

1. User types goal in React sidebar
2. `useAgent` hook sends `{ type: "AGENT_REQUEST", text }` to background
3. Background gathers: EXTRACT (url, title, text, candidates) + screenshot
4. Background calls `POST http://127.0.0.1:8765/plan`
5. Server creates planner via factory pattern, generates plan
6. Server returns `{ summary, steps[] }` (with fallback on error)
7. React updates state, `PlanViewer` displays steps
8. User clicks "Run next" to execute steps one-by-one via content script

## Safety Model

- Step-by-step execution (human-in-the-loop)
- Background blocks risky actions: checkout/payment URLs, password/OTP/2FA fields, destructive actions (delete/cancel/unsubscribe/send/publish)

## Key TypeScript Interfaces

```typescript
type Tool = "CLICK" | "TYPE" | "SCROLL" | "NAVIGATE";

interface Step {
  tool: Tool;
  selector?: string;
  text?: string;
  deltaY?: number;
  url?: string;
  note?: string;
}

interface PlanResponse {
  summary: string;
  steps: Step[];
  error?: string;
}
```

## Key Files

- `docs/FRONTEND.md` - Detailed React component architecture
- `docs/BACKEND.md` - Backend architecture and provider details
- `docs/CODEBASE.md` - Full codebase overview with setup instructions
- `zen_extension/src/sidebar/hooks/useAgent.ts` - Main agent communication hook
- `zen_extension/background.js` - Extension orchestrator
- `agent_server/app/main.py` - FastAPI app entry point
- `agent_server/app/routers/plan.py` - Plan endpoint with fallback logic
- `agent_server/app/planner/factory.py` - Planner factory pattern
