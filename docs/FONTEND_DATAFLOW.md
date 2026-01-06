# Frontend Data Flow Overview

This document summarizes how a user request flows from the React UI in the sidebar, through the background and content scripts, to the FastAPI backend, and back again.  It references all key functions by **signature** and the file in which they live.

## 1. User enters a goal in the sidebar
| Layer | File | Function | Signature |
|-------|------|----------|-----------|
| React UI (sidebar) | `zen_extension/src/sidebar/hooks/useAgent.ts` | `sendRequest` | `async (text: string): Promise<PlanResponse>` |
| React UI | `useAgent.ts` | `runNextStep` | `async (): Promise<StepResultResponse>` |

## 2. UI → Background (message passing)
| Layer | File | Function | Signature |
|-------|------|----------|-----------|
| React UI | `useAgent.ts` | `sendMessage<T>` (via `useBrowserRuntime`) | `<T>(message: unknown) => Promise<T>` |
| Background | `zen_extension/src/sidebar/hooks/useBrowserRuntime.ts` | `useBrowserRuntime` | `() => { sendMessage: <T>(msg) => Promise<T> }` |
| Background | `zen_extension/background.js` | `browser.runtime.onMessage.addListener` | `(msg) => Promise<any>` |

## 3. Background → Content Script (page snapshot)
| Layer | File | Function | Signature |
|-------|------|----------|-----------|
| Background | `background.js` | `callContent(tabId, payload)` | `(tabId: number, payload: any) => Promise<any>` |
| Content Script | `zen_extension/contentScript.js` | `isVisible` (used by the content script to filter candidates) | `(element: Element) => boolean` |
| Content Script | `contentScript.js` | `extractPage()` (implicit in the `EXTRACT` message handler) | `() => Promise<PageSnapshot>` |

## 4. Background → Screenshot (optional)
| Layer | File | Function | Signature |
|-------|------|----------|-----------|
| Background | `background.js` | `captureScreenshot()` | `() => Promise<string | null>` |

## 5. Background → Backend (plan request)
| Layer | File | Function | Signature |
|-------|------|----------|-----------|
| Background | `background.js` | `callAgentServer(payload, maxRetries?)` | `(payload: PlanRequestBody, maxRetries?: number) => Promise<PlanResponse>` |
| Backend | `agent_server/app/routers/plan.py` | `create_plan(request: PlanRequest, settings: Settings)` | `async def create_plan(...) -> PlanResponse` |

## 6. Backend → Background (plan response)
The FastAPI endpoint returns a JSON `PlanResponse` which the background script receives and stores in `planState`.

## 7. Background → UI (plan data)
| Layer | File | Function | Signature |
|-------|------|----------|-----------|
| Background | `background.js` | Returns `{ summary, steps, connectionStatus }` to the UI. |
| React UI | `useAgent.ts` | Receives the response, transforms each step into `StepWithStatus` and updates state. |

## 8. UI → Background (step execution)
| Layer | File | Function | Signature |
|-------|------|----------|-----------|
| React UI | `useAgent.ts` | `runNextStep` | `async (): Promise<StepResultResponse>` |
| Background | `background.js` | `executeStep(tabId, step)` | `(tabId: number, step: Step) => Promise<any>` |
| Content Script | `contentScript.js` | Performs DOM action (CLICK, TYPE, SCROLL, NAVIGATE). |

## 9. Content Script → Background (step result)
The content script replies with `{ ok: true }` or an error object, which the background forwards back to the UI via `runNextStep`.

---
## Example JSON Data Transformation
Below is a minimal example of the data objects at each stage.  The arrows (`→`) indicate the transformation or function call that produces the next object.

```json
{
  "userRequest": "search for cats",                      // UI input (sendRequest)
  "page": {
    "url": "https://google.com/",
    "title": "Google",
    "text": "About 1,240,000,000 results...",
    "candidates": [
      {"selector":"#search-input","tag":"input","placeholder":"Search Google"},
      {"selector":"#search-btn","tag":"button","text":"Google Search"}
    ]
  },
  "screenshotDataUrl": null                              // optional
}
→ callAgentServer(payload) →
{
  "summary": "Planned search for \"cats\".",
  "steps": [
    {"tool":"CLICK","selector":"#search-input","note":"Focus the search box"},
    {"tool":"TYPE","selector":"#search-input","text":"cats","note":"Type: \"cats\""},
    {"tool":"CLICK","selector":"#search-btn","note":"Submit search"}
  ],
  "error": null
}
→ background stores in planState and returns to UI →
{
  "summary": "Planned search for \"cats\".",
  "steps": [
    {"tool":"CLICK","selector":"#search-input","note":"Focus the search box","status":"pending"},
    {"tool":"TYPE","selector":"#search-input","text":"cats","note":"Type: \"cats\"","status":"pending"},
    {"tool":"CLICK","selector":"#search-btn","note":"Submit search","status":"pending"}
  ]
}
→ UI renders steps. User clicks "Run next":
Background calls executeStep(tabId, step) → contentScript performs CLICK/TYPE.
Content script returns {"ok":true} → background forwards to UI, which updates step status to "completed".
```

The above flow demonstrates how data is built, transmitted, and transformed across all layers of the application.
