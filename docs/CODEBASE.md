
# Codebase Overview

This repo is a **tab-only browser automation agent** for Zen (Firefox-family). The agent lives in a **right-side sidebar panel** and can **observe + act inside the currently active tab** (DOM text + candidate controls + optional visible-tab screenshot).

## High-level architecture

```
[Zen Sidebar UI]  <->  [Background Orchestrator]  <->  [Content Script in Tab]
  (React + TS)                  |                           |
       |                        |                           +-- Click / Type / Scroll / Extract
       |                        |
       |                        +-- HTTP (localhost) -->  [FastAPI Agent Server]
       |                                                   (returns JSON tool plan)
```

### Responsibilities

- **Sidebar (UI):** React + TypeScript app with chat input, plan viewer, and a "Run next" button for step-by-step execution.
- **Background script (controller):**
  - Collects observations (`EXTRACT` + screenshot)
  - Sends them to the agent server (`POST /plan`)
  - Stores the returned plan and executes steps one-by-one
  - Enforces basic safety gating (blocks risky actions)
- **Content script (tab tools):** Runs inside the webpage and performs the actual DOM interactions:
  - `EXTRACT` (URL/title/visible text + candidate controls)
  - `CLICK` / `TYPE` / `SCROLL`
- **FastAPI server (planner):** Given the user request + page snapshot, returns a strict JSON plan:
  - A list of tool steps the extension can execute safely
  - A human-readable summary

## Tech Stack

| Component | Technology |
|-----------|------------|
| Sidebar UI | React 18 + TypeScript + Vite |
| Background/Content Scripts | Vanilla JS (WebExtension APIs) |
| Agent Server | FastAPI + Pydantic |
| Build Tool | Vite |

## Repo layout

```
Zen-Browser-Agent/
  docs/
    CODEBASE.md
    FRONTEND.md              # Detailed React component architecture
    PRD.md

  agent_server/              # FastAPI "brains" (planner)
    requirements.txt
    app.py                   # /plan endpoint + Pydantic schemas

  zen_extension/             # Zen/Firefox WebExtension (sidebar agent)
    src/
      sidebar/
        main.tsx             # React entry point
        App.tsx              # Root component
        App.css
        components/
          Header.tsx
          Chat.tsx
          ChatMessage.tsx
          PlanViewer.tsx
          StepItem.tsx
          Composer.tsx
        hooks/
          useAgent.ts        # Agent communication hook
          useBrowserRuntime.ts
        types/
          index.ts
          messages.ts
          plan.ts
    public/
      sidebar.html
    dist/                    # Vite build output
    manifest.json
    background.js            # orchestrator + safety gating + step runner
    contentScript.js         # tab tools: EXTRACT/CLICK/TYPE/SCROLL
    vite.config.ts
    tsconfig.json
    package.json
```

### Recommended evolution (when the MVP works)

Once you confirm the pipeline works end-to-end, refactor the FastAPI side into modules for maintainability:

```
agent_server/
  app/
    main.py                   # FastAPI app + middleware
    schemas.py                # Pydantic models (PlanRequest/PlanResponse/Step)
    planner/
      rule_based.py           # current heuristic planner
      llm_planner.py          # future: LLM-backed planner (same schema output)
    routers/
      plan.py                 # POST /plan
```

## Data flow (request → plan → execution)

1. **You type a goal** in the sidebar (e.g., `search transformers attention`).
2. React sidebar sends `{ type: "AGENT_REQUEST", text }` via `useAgent` hook to the background script.
3. Background gathers observations from the active tab:
   - `EXTRACT`: `{ url, title, text, candidates[] }`
   - `captureVisibleTab`: screenshot (data URL)
4. Background calls the planner server:
   - `POST http://127.0.0.1:8765/plan`
5. Server returns:
   - `summary`
   - `steps: [{ tool, selector?, text?, deltaY?, url?, note? }, ...]`
6. React sidebar displays the plan via `PlanViewer` component.
7. When you press **Run next**, `useAgent` hook triggers background to execute the next step via the content script.
8. Background updates internal state (`idx++`) and React updates step status.

## Safety model (MVP)

- Execution is **step-by-step** (human-in-the-loop) via "Run next".
- Background blocks obviously risky actions (heuristics):
  - checkout/payment URLs
  - typing into password/OTP/2FA fields
  - destructive actions like delete/cancel/unsubscribe/send/publish

> You can harden this later by adding explicit user approvals for certain tools, domain allowlists, and more robust intent classification.

---

## Step 1 — Add the FastAPI agent server

Create: agent_server/requirements.txt

```
fastapi==0.115.6
uvicorn[standard]==0.34.0
pydantic==2.10.4
```

Create: agent_server/app.py

```python
from __future__ import annotations

from typing import List, Optional, Literal, Set
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

app = FastAPI(title="Zen Tab Agent Server", version="0.1.0")

# Local dev CORS. Tighten later.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

Tool = Literal["CLICK", "TYPE", "SCROLL", "NAVIGATE"]

class Candidate(BaseModel):
    selector: str
    tag: str
    text: str = ""
    ariaLabel: str = ""
    placeholder: str = ""
    name: str = ""
    type: str = ""
    href: str = ""

class PageSnapshot(BaseModel):
    url: str
    title: str
    text: str
    candidates: List[Candidate] = Field(default_factory=list)

class PlanRequest(BaseModel):
    userRequest: str
    page: PageSnapshot
    screenshotDataUrl: Optional[str] = None  # optional; ignored in MVP

class Step(BaseModel):
    tool: Tool
    selector: Optional[str] = None
    text: Optional[str] = None
    deltaY: Optional[int] = None
    url: Optional[str] = None
    note: Optional[str] = None  # explanation for you

class PlanResponse(BaseModel):
    summary: str
    steps: List[Step]

def best_match(cands: List[Candidate], include_tags: Set[str], keywords: List[str]) -> Optional[Candidate]:
    keywords_l = [k.lower().strip() for k in keywords if k and k.strip()]
    best = None
    best_score = -1

    for c in cands:
        if c.tag.lower() not in include_tags:
            continue

        hay = " ".join([
            c.text or "",
            c.ariaLabel or "",
            c.placeholder or "",
            c.name or "",
            c.href or "",
        ]).lower()

        score = 0
        for k in keywords_l:
            if k in hay:
                score += 2

        # prefer better-labeled controls
        if c.ariaLabel: score += 1
        if c.placeholder: score += 1
        if c.text: score += 1

        if score > best_score:
            best_score = score
            best = c

    return best

def rule_based_plan(req: PlanRequest) -> PlanResponse:
    goal = req.userRequest.strip()
    goal_l = goal.lower()
    page = req.page
    cands = page.candidates

    steps: List[Step] = []

    # "search <query>"
    if "search" in goal_l:
        idx = goal_l.find("search")
        query = goal[idx + len("search"):].strip(" :,-") or goal

        search_input = best_match(
            cands,
            include_tags={"input", "textarea"},
            keywords=["search", "q", "query", "find", "looking for"]
        )

        if search_input:
            steps.append(Step(tool="CLICK", selector=search_input.selector, note="Focus the search box"))
            steps.append(Step(tool="TYPE", selector=search_input.selector, text=query, note=f'Type: "{query}"'))

            submit_btn = best_match(
                cands,
                include_tags={"button", "a", "input"},
                keywords=["search", "submit", "go"]
            )
            if submit_btn:
                steps.append(Step(tool="CLICK", selector=submit_btn.selector, note="Submit search"))
            else:
                # Many sites submit on Enter; we'll just stop here.
                pass

            return PlanResponse(summary=f'Planned search for "{query}".', steps=steps)

    # "scroll down"
    if any(k in goal_l for k in ["scroll", "go down", "down"]):
        steps.append(Step(tool="SCROLL", deltaY=900, note="Scroll down"))
        return PlanResponse(summary="Scrolling.", steps=steps)

    # "click <thing>"
    if goal_l.startswith("click "):
        target = goal[6:].strip()
        btn = best_match(cands, include_tags={"button", "a"}, keywords=[target])
        if btn:
            steps.append(Step(tool="CLICK", selector=btn.selector, note=f'Click something matching "{target}"'))
            return PlanResponse(summary=f'Clicking "{target}".', steps=steps)

    return PlanResponse(
        summary="No confident automation plan. Try: 'search <term>', 'click <button text>', or 'scroll down'.",
        steps=[]
    )

@app.post("/plan", response_model=PlanResponse)
def plan(req: PlanRequest) -> PlanResponse:
    # Later: replace rule_based_plan with an LLM planner that outputs the same schema.
    return rule_based_plan(req)
```

Run the server:

```bash
cd agent_server
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app:app --host 127.0.0.1 --port 8765 --reload
```

---

## Step 2 — Set up the Zen sidebar extension (React + TypeScript + Vite)

### Initialize the project

```bash
cd zen_extension
npm init -y
npm install react react-dom
npm install -D typescript vite @vitejs/plugin-react @types/react @types/react-dom @types/webextension-polyfill
```

### Create configuration files

Create: zen_extension/tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"]
}
```

Create: zen_extension/vite.config.ts

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
    rollupOptions: {
      input: {
        sidebar: resolve(__dirname, "public/sidebar.html"),
      },
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "[name].js",
        assetFileNames: "[name].[ext]",
      },
    },
    cssCodeSplit: false,
    modulePreload: false,
  },
});
```

Create: zen_extension/package.json scripts

```json
{
  "scripts": {
    "dev": "vite build --watch",
    "build": "tsc && vite build",
    "typecheck": "tsc --noEmit"
  }
}
```

### Create manifest.json

```json
{
  "manifest_version": 2,
  "name": "Zen Tab Agent (Sidebar)",
  "version": "0.1.0",
  "description": "Sidebar agent that reads/acts inside the current tab.",
  "permissions": [
    "activeTab",
    "tabs",
    "storage",
    "<all_urls>",
    "http://127.0.0.1/*"
  ],
  "background": {
    "scripts": ["background.js"]
  },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["contentScript.js"],
      "run_at": "document_idle"
    }
  ],
  "sidebar_action": {
    "default_title": "Zen Agent",
    "default_panel": "dist/sidebar.html",
    "open_at_install": true
  },
  "content_security_policy": "script-src 'self'; object-src 'self'"
}
```

### Create React sidebar

See `docs/FRONTEND.md` for complete component implementations.

Key files:
- `src/sidebar/main.tsx` - Entry point
- `src/sidebar/App.tsx` - Root component
- `src/sidebar/components/` - UI components (Header, Chat, PlanViewer, Composer)
- `src/sidebar/hooks/useAgent.ts` - Agent communication hook
- `src/sidebar/types/` - TypeScript interfaces

### Create background.js

```javascript
let planState = { steps: [], idx: 0, summary: "" };

async function getActiveTab() {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function callContent(tabId, payload) {
  return browser.tabs.sendMessage(tabId, payload);
}

async function captureScreenshot() {
  return browser.tabs.captureVisibleTab(null, { format: "png" });
}

function isRiskyStep(step, pageSnapshot) {
  const riskyWords = ["pay","checkout","purchase","order","delete","cancel","unsubscribe","send","publish","confirm"];
  const url = (pageSnapshot?.url || "").toLowerCase();

  if (riskyWords.some(w => url.includes(w))) return true;

  if (step.tool === "TYPE") {
    const sel = (step.selector || "").toLowerCase();
    if (sel.includes("password") || sel.includes("otp") || sel.includes("2fa")) return true;
  }

  if (step.tool === "CLICK") {
    const note = (step.note || "").toLowerCase();
    if (riskyWords.some(w => note.includes(w))) return true;
  }

  return false;
}

async function callAgentServer(payload) {
  const r = await fetch("http://127.0.0.1:8765/plan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!r.ok) throw new Error(`Agent server returned ${r.status}`);
  return r.json();
}

async function executeStep(tabId, step) {
  switch (step.tool) {
    case "CLICK":
    case "TYPE":
    case "SCROLL":
      return callContent(tabId, step);
    case "NAVIGATE":
      await browser.tabs.update(tabId, { url: step.url });
      return { ok: true };
    default:
      return { ok: false, error: `Unknown tool: ${step.tool}` };
  }
}

browser.runtime.onMessage.addListener(async (msg) => {
  try {
    if (msg.type === "AGENT_REQUEST") {
      const tab = await getActiveTab();
      const page = await callContent(tab.id, { tool: "EXTRACT" });
      const screenshotDataUrl = await captureScreenshot();

      const plan = await callAgentServer({ userRequest: msg.text, page, screenshotDataUrl });

      planState = { steps: plan.steps || [], idx: 0, summary: plan.summary || "" };
      return { summary: planState.summary, steps: planState.steps };
    }

    if (msg.type === "RUN_NEXT_STEP") {
      const tab = await getActiveTab();
      const page = await callContent(tab.id, { tool: "EXTRACT" });

      if (!planState.steps || planState.idx >= planState.steps.length) {
        return { done: true, message: "No steps left." };
      }

      const step = planState.steps[planState.idx];

      if (isRiskyStep(step, page)) {
        return { error: "Blocked: risky step (login/checkout/delete/send/publish). Do this manually or refine request." };
      }

      const result = await executeStep(tab.id, step);
      const ranIndex = planState.idx;
      planState.idx += 1;

      if (!result?.ok && result?.error) return { ranIndex, error: result.error };

      return {
        ranIndex,
        message: step.note || `${step.tool} executed.`,
        done: planState.idx >= planState.steps.length
      };
    }
  } catch (e) {
    return { error: String(e?.message || e) };
  }
});
```

### Create contentScript.js

```javascript
function isVisible(el) {
  const r = el.getBoundingClientRect();
  if (r.width < 6 || r.height < 6) return false;
  if (r.bottom < 0 || r.right < 0) return false;
  if (r.top > window.innerHeight || r.left > window.innerWidth) return false;
  const s = window.getComputedStyle(el);
  return s.display !== "none" && s.visibility !== "hidden" && s.opacity !== "0";
}

function cssEscape(s) {
  return String(s).replace(/([ #;?%&,.+*~\':"!^$[\]()=>|\/@])/g, "\\$1");
}

function selectorFor(el) {
  if (el.id) return `#${cssEscape(el.id)}`;

  const name = el.getAttribute("name");
  if (name) return `${el.tagName.toLowerCase()}[name="${name.replace(/"/g, '\\"')}"]`;

  const aria = el.getAttribute("aria-label");
  if (aria) return `${el.tagName.toLowerCase()}[aria-label="${aria.replace(/"/g, '\\"')}"]`;

  const placeholder = el.getAttribute("placeholder");
  if (placeholder) return `${el.tagName.toLowerCase()}[placeholder="${placeholder.replace(/"/g, '\\"')}"]`;

  let cur = el;
  const parts = [];
  for (let i = 0; i < 4 && cur && cur.nodeType === 1; i++) {
    const tag = cur.tagName.toLowerCase();
    const parent = cur.parentElement;
    if (!parent) break;
    const siblings = Array.from(parent.children).filter(x => x.tagName === cur.tagName);
    const idx = siblings.indexOf(cur) + 1;
    parts.unshift(`${tag}:nth-of-type(${idx})`);
    cur = parent;
  }
  return parts.join(" > ");
}

function extractCandidates() {
  const els = Array.from(document.querySelectorAll("a,button,input,textarea,select,[role='button']"));
  const out = [];
  for (const el of els) {
    if (!isVisible(el)) continue;

    out.push({
      selector: selectorFor(el),
      tag: el.tagName.toLowerCase(),
      text: (el.innerText || el.textContent || "").trim().slice(0, 80),
      ariaLabel: (el.getAttribute("aria-label") || "").trim().slice(0, 80),
      placeholder: (el.getAttribute("placeholder") || "").trim().slice(0, 80),
      name: (el.getAttribute("name") || "").trim().slice(0, 80),
      type: (el.getAttribute("type") || "").trim().slice(0, 30),
      href: (el.getAttribute("href") || "").trim().slice(0, 120)
    });

    if (out.length >= 60) break;
  }
  return out;
}

function visibleText() {
  return (document.body?.innerText || "").slice(0, 40000);
}

function clickSelector(selector) {
  const el = document.querySelector(selector);
  if (!el) return { ok: false, error: `No element for selector: ${selector}` };
  el.click();
  return { ok: true };
}

function typeSelector(selector, text) {
  const el = document.querySelector(selector);
  if (!el) return { ok: false, error: `No element for selector: ${selector}` };
  el.focus();
  el.value = text;
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
  return { ok: true };
}

function scrollByAmount(deltaY) {
  window.scrollBy({ top: deltaY, left: 0, behavior: "smooth" });
  return { ok: true };
}

browser.runtime.onMessage.addListener(async (msg) => {
  if (msg.tool === "EXTRACT") {
    return { url: location.href, title: document.title, text: visibleText(), candidates: extractCandidates() };
  }
  if (msg.tool === "CLICK") return clickSelector(msg.selector);
  if (msg.tool === "TYPE") return typeSelector(msg.selector, msg.text || "");
  if (msg.tool === "SCROLL") return scrollByAmount(msg.deltaY || 700);
  return { ok: false, error: "Unknown tool in content script." };
});
```

---

## Step 3 — Build and load extension

1. Build the React sidebar:

```bash
cd zen_extension
npm run build
```

2. Start FastAPI:

```bash
cd agent_server
source .venv/bin/activate
uvicorn app:app --host 127.0.0.1 --port 8765 --reload
```

3. In Zen, open:
   - `about:debugging` → Load Temporary Add-on → select `zen_extension/manifest.json`

4. Visit a page (Google, Wikipedia, etc.) and try in the sidebar:
   - `search transformers attention`
   - `scroll down`
   - `click about`

---
