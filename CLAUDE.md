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
| Build Tool | Vite |

## Architecture

```
[Zen Sidebar UI]  <->  [Background Orchestrator]  <->  [Content Script in Tab]
  (React + TS)                  |                           |
       |                        |                           +-- Click / Type / Scroll / Extract
       |                        |
       |                        +-- HTTP (localhost) -->  [FastAPI Agent Server]
                                                          (returns JSON tool plan)
```

### Component Responsibilities

- **Sidebar (UI):** React + TypeScript app with chat input, plan viewer, step-by-step execution via "Run next" button
- **Background script:** Collects observations (EXTRACT + screenshot), calls agent server, executes plan steps, enforces safety gating
- **Content script:** Performs DOM interactions (EXTRACT, CLICK, TYPE, SCROLL)
- **FastAPI server:** Given user request + page snapshot, returns JSON plan with tool steps

## Repository Layout

```
agent_server/               # FastAPI planner
  requirements.txt
  app.py                    # /plan endpoint + Pydantic schemas

zen_extension/              # Zen/Firefox WebExtension
  src/
    sidebar/
      main.tsx              # React entry point
      App.tsx               # Root component
      components/           # Header, Chat, PlanViewer, Composer
      hooks/                # useAgent, useBrowserRuntime
      types/                # TypeScript interfaces
  public/
    sidebar.html
  dist/                     # Vite build output
  manifest.json
  background.js             # orchestrator + safety + step runner
  contentScript.js          # tab tools: EXTRACT/CLICK/TYPE/SCROLL
  vite.config.ts
  tsconfig.json
  package.json
```

## Development Commands

### Agent Server
```bash
cd agent_server
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app:app --host 127.0.0.1 --port 8765 --reload
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

## Data Flow

1. User types goal in React sidebar
2. `useAgent` hook sends `{ type: "AGENT_REQUEST", text }` to background
3. Background gathers: EXTRACT (url, title, text, candidates) + screenshot
4. Background calls `POST http://127.0.0.1:8765/plan`
5. Server returns `{ summary, steps[] }`
6. React updates state, `PlanViewer` displays steps
7. User clicks "Run next" to execute steps one-by-one via content script

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

- `docs/FRONTEND.md` - Detailed React component architecture and implementations
- `docs/CODEBASE.md` - Full codebase overview with setup instructions
- `zen_extension/src/sidebar/hooks/useAgent.ts` - Main agent communication hook
- `zen_extension/background.js` - Extension orchestrator
- `agent_server/app.py` - FastAPI planner endpoint
