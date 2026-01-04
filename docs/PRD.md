# Product Requirements Document (PRD)

## Product
**Zen Tab Agent** — A tab-only browser automation assistant embedded as a right-side sidebar in Zen (Firefox-family).

## Document control
- **Owner:** Product + Engineering
- **Status:** Draft
- **Last updated:** 2026-01-03
- **Target release:** MVP (Phase 1), Beta (Phase 2), GA (Phase 3)

---

## 1. Summary
Zen Tab Agent is an AI-assisted browser automation experience that lives in a right-side sidebar panel and can **observe and act inside the currently active tab only**. It provides **human-in-the-loop automation**: the agent proposes a structured plan (JSON tool steps) and the user executes steps one-by-one (or later: safe auto-run policies) to complete workflows such as searching, form-filling, navigation, and repetitive page actions.

The system is built from two cooperating components:
- A **Zen/Firefox WebExtension** (sidebar UI + background orchestrator + tab content tools)
- A **local FastAPI agent server** (planner) that returns validated tool plans

The design prioritizes:
- Safety (no OS/desktop control, step-by-step execution, risky-action gating)
- Reliability (DOM-candidate extraction to avoid hallucinated selectors)
- Extensibility (pluggable planner backends: heuristic → LLM)

---

## 2. Goals and non-goals

### 2.1 Goals
1. **Tab-only automation**: The agent can observe (DOM text + candidates + optional visible-tab screenshot) and act (click/type/scroll/navigate) *inside the active tab*.
2. **Production-grade safety posture**: Human-in-the-loop execution; block or require explicit approval for risky actions (payments, passwords, destructive actions, publishing/sending).
3. **Deterministic tool contract**: Planner returns strict JSON steps from an allowlisted tool schema; extension executes only those tools.
4. **High reliability**: Reduce failures from brittle selectors by providing candidate controls to planner.
5. **Fast iteration loop**: Agent server runs locally (FastAPI) for rapid planner improvements and easy model swapping.
6. **Observability and debugging**: Clear logs for plan generation, tool execution, and errors.

### 2.2 Non-goals (initially)
- **Desktop/OS automation** (mouse/keyboard across apps)
- **Persistent background monitoring** of pages
- **Multi-tab/multi-window orchestration** beyond the active tab
- **Guaranteed completion** on every site (anti-bot, shadow DOM complexity, heavy SPAs)
- **Autonomous purchasing / account changes**

---

## 3. Users and use cases

### 3.1 Target users
- Power users building workflows in the browser (research, operations, data collection)
- Developers and AI builders testing agentic flows
- Students/professionals automating repetitive tasks

### 3.2 Core use cases (MVP)
1. **Search and browse**
   - “search transformers attention”
   - Agent focuses search box, types, submits
2. **Page navigation**
   - “click pricing”, “open documentation”, “scroll down”
3. **Form fill (non-sensitive)**
   - “fill name/email fields with …” (excluding passwords/OTP)
4. **Guided assistance** (coach mode)
   - When automation is uncertain, agent provides step-by-step human instructions

### 3.3 Extended use cases (post-MVP)
- Replanning after each step (“observe → plan → act → observe”)
- Lightweight macros / templates for common sites
- Domain allowlists and per-site policies
- User-taught selectors (point-and-click element selection)

---

## 4. Product experience

### 4.1 UX principles
- **Clarity:** Always show what the agent intends to do next.
- **Control:** User approves execution, at least step-by-step.
- **Trust:** Visible logs; no hidden actions.
- **Recoverability:** Easy to stop, retry, or revise.

### 4.2 Sidebar UI (MVP)
- Chat composer (user goal input)
- Agent response summary
- Plan viewer listing steps
- “Run next” button to execute the next step
- Step status (done / failed)

### 4.3 Modes
- **Coach Mode (default):** Agent proposes steps, but may recommend user manual actions when uncertain.
- **Execute Mode (MVP):** Step-by-step execution via “Run next”.
- **Auto Mode (future):** Execute multiple low-risk steps automatically with policy gating.

---

## 5. Functional requirements

### 5.1 Extension: Sidebar UI
**FR-UI-1:** Provide a sidebar panel accessible from Zen that shows chat + plan + controls.

**FR-UI-2:** Display planner output:
- `summary`
- ordered `steps[]` with readable rendering for each tool

**FR-UI-3:** Provide execution controls:
- Run next step
- Disable run when no plan/steps left

**FR-UI-4:** Surface errors in a user-readable form (e.g., “selector not found”).

### 5.2 Extension: Background Orchestrator
**FR-BG-1:** Gather observations from the active tab:
- URL + title + visible text (bounded)
- Candidate controls list (bounded)
- Optional visible-tab screenshot (data URL)

**FR-BG-2:** Send plan request to local planner service over HTTP:
- Endpoint: `POST http://127.0.0.1:8765/plan`
- Payload includes user request + page snapshot + optional screenshot

**FR-BG-3:** Maintain plan state:
- `steps[]`
- current index (`idx`)
- summary

**FR-BG-4:** Execute next step by dispatching tool messages to content script or tab navigation API.

**FR-BG-5 (Safety gating MVP):** Block execution when risky:
- URLs containing checkout/payment signals
- `TYPE` into password/otp/2fa fields
- Buttons/notes with destructive/send/publish keywords

**FR-BG-6:** Provide result reporting to sidebar:
- which step ran
- success/failure
- when plan completes

### 5.3 Extension: Content Script (Tab Tools)
**FR-CS-1:** Implement `EXTRACT` tool returning:
- `url`, `title`
- `text` (bounded, e.g., 40k chars)
- `candidates[]` (bounded, e.g., 60)

**FR-CS-2:** Candidate extraction must include:
- selector (generated)
- tag type
- visible label text / aria-label / placeholder
- name/type/href when present

**FR-CS-3:** Implement action tools:
- `CLICK { selector }`
- `TYPE { selector, text }`
- `SCROLL { deltaY }`

**FR-CS-4:** Provide best-effort selector strategy:
- Prefer `#id`
- Else `tag[name=...]`, `tag[aria-label=...]`, `tag[placeholder=...]`
- Else short `nth-of-type` path (bounded depth)

### 5.4 FastAPI Planner Server
**FR-SRV-1:** Provide `/plan` endpoint with validated Pydantic schemas:
- `PlanRequest { userRequest, page{...}, screenshotDataUrl? }`
- `PlanResponse { summary, steps[] }`

**FR-SRV-2:** Return steps using only allowlisted tools:
- `CLICK`, `TYPE`, `SCROLL`, `NAVIGATE`

**FR-SRV-3:** Planner must prefer selecting from `candidates[]` rather than inventing selectors.

**FR-SRV-4 (MVP):** Provide rule-based planning for:
- “search <query>”
- “scroll down”
- “click <label>”

**FR-SRV-5 (Future):** Support LLM-backed planning with:
- strict JSON schema enforcement
- retry on invalid schema
- optional tool simulation/safety checks

---

## 6. Non-functional requirements

### 6.1 Performance
- Plan generation (local server): p95 < 800ms for rule-based MVP
- UI responsiveness: no long-blocking operations on UI thread
- Candidate extraction: bounded list and bounded text size

### 6.2 Reliability
- Extension should fail safely: no execution on parse errors
- Planner response must be validated before execution
- Each tool action returns structured error messages

### 6.3 Security & privacy
- **Tab-only scope:** No desktop capture, no OS automation.
- Localhost communication only (`127.0.0.1`).
- No sensitive data exfiltration by default.
- Provide clear documentation: what data is sent to the local server (page text, candidates, screenshot).

### 6.4 Compatibility
- Zen (Firefox-family). Prefer Manifest V2 for compatibility.
- Work across common page types (static sites and SPAs), acknowledging limitations.

---

## 7. System design

### 7.1 Component diagram
```
Sidebar (HTML/JS/CSS)
   |  runtime messaging
Background (controller)
   |  tabs API + content messaging
Content Script (tab tools)
   |  DOM
Active Tab

Background  <--HTTP-->  FastAPI /plan
```

### 7.2 Tool contract (canonical)
Each step is one of:
- `CLICK`: `{ tool: "CLICK", selector: string, note?: string }`
- `TYPE`: `{ tool: "TYPE", selector: string, text: string, note?: string }`
- `SCROLL`: `{ tool: "SCROLL", deltaY: number, note?: string }`
- `NAVIGATE`: `{ tool: "NAVIGATE", url: string, note?: string }`

### 7.3 Data model
- `PageSnapshot.text` is truncated to a fixed maximum to avoid oversized payloads.
- `candidates[]` is a capped list of interactive controls that are visible.
- `screenshotDataUrl` is optional and used for future vision-based disambiguation.

---

## 8. Safety design

### 8.1 Safety tiers
- **Tier 0:** Read-only coaching (no actions)
- **Tier 1 (MVP):** Step-by-step execution with heuristic risk blocks
- **Tier 2:** Policy-based approvals (per-site allowlists, per-tool confirmations)
- **Tier 3:** Limited auto-run for low-risk steps with a stop button

### 8.2 Risk heuristics (MVP)
Block execution when:
- URL contains: `checkout`, `pay`, `purchase`, `order`, `billing`
- TYPE selector contains: `password`, `otp`, `2fa`
- Notes/text contains: `delete`, `cancel`, `unsubscribe`, `send`, `publish`, `confirm`

### 8.3 Stop and recovery
- User can stop by not clicking “Run next”.
- Future: explicit “Stop” and “Reset plan” controls.

---

## 9. Telemetry and metrics

### 9.1 Success metrics
- **Task success rate:** % of tasks completed without manual workaround
- **Step success rate:** % of tool steps executed successfully
- **Time-to-complete:** median seconds from request to completion
- **User trust signals:** low rate of blocked/risky attempts and clear messaging

### 9.2 Quality metrics
- Selector failure rate (`No element for selector`)
- Planner invalid-step rate (schema validation failures)
- Replan frequency and outcomes (future)

---

## 10. QA, testing, and validation

### 10.1 Testing strategy
- Unit tests (FastAPI): schema validation, planner scoring, keyword rules
- Unit tests (content script): selector generation, candidate extraction bounds
- Integration tests: local server + extension tool execution on test pages

### 10.2 Test environments
- Simple static test pages (inputs/buttons)
- Common SPAs (basic interactions only)

### 10.3 Acceptance criteria (MVP)
1. User can load extension and open sidebar.
2. User can issue `search <query>` on a site with a visible search input.
3. Agent generates a plan with steps displayed.
4. User can run steps one-by-one; steps are marked done.
5. Risky actions are blocked with clear explanation.

---

## 11. Rollout plan

### Phase 1 — MVP (Developer Preview)
- Rule-based planning
- Step-by-step execution
- Candidate-based selection
- Basic safety gating

### Phase 2 — Beta
- Replan loop after each step
- Better candidate ranking; robustness improvements
- User-taught selectors (element picker)
- Structured logging and exportable debug traces

### Phase 3 — GA
- LLM-backed planner with schema enforcement
- Policy-based approvals and domain allowlists
- Auto-run for low-risk sequences
- Improved UI/UX polish

---

## 12. Risks and mitigations

1. **Brittle selectors / dynamic pages**
   - Mitigation: candidate list + prefer stable attributes + optional element picker
2. **Sites with anti-bot or heavy shadow DOM**
   - Mitigation: coach mode fallback; clearly communicate limitations
3. **Safety concerns (unintended destructive actions)**
   - Mitigation: blocking + approvals; default to step-by-step
4. **Payload size / performance**
   - Mitigation: truncate page text, cap candidates, optional screenshot
5. **Extension compatibility changes**
   - Mitigation: keep tool contract stable; isolate platform-specific APIs

---

## 13. Open questions
- Should screenshot sending be opt-in by default?
- Should we store per-site preferences (allowlist/denylist)?
- Do we want a “coach-only” toggle to disable all automation on demand?
- What planner backend is intended for Beta (local model vs API model)?

---

## Appendix A — Example plan

**User:** “search nvidia ignite”

**Server response:**
```json
{
  "summary": "Planned search for \"nvidia ignite\".",
  "steps": [
    {"tool": "CLICK", "selector": "input[name=\"q\"]", "note": "Focus the search box"},
    {"tool": "TYPE", "selector": "input[name=\"q\"]", "text": "nvidia ignite", "note": "Type query"},
    {"tool": "CLICK", "selector": "button[type=\"submit\"]", "note": "Submit search"}
  ]
}
```
