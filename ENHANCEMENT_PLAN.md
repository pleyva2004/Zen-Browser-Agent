# Zen Tab Agent Enhancement Plan

**Goal:** Achieve feature parity with Claude in Chrome + add RAG chat as a differentiator
**Timeline:** 5 weeks (full-time)
**Purpose:** Portfolio/Demo

---

## Current State vs Target State

| Capability | Current | Target |
|------------|---------|--------|
| Core Actions (click, type, scroll, navigate) | 4 actions | 10+ actions |
| Screenshot Capture | No | Yes |
| RAG Chat Mode | No | Yes (differentiator) |
| Semantic Element Search | No (selector-based) | Yes (NL queries) |
| Console/Network Inspection | No | Yes |
| Multi-tab Workflows | No | Future |
| GIF Recording | No | Future |
| Injection Defense | Basic | Enhanced |

---

## Architecture Evolution

### Current Flow
```
User Input → /plan → Steps[] → Execute
```

### Target Flow
```
User Input → Intent Classifier
                    │
         ┌──────────┴──────────┐
         ▼                     ▼
    CHAT MODE              ACTION MODE
         │                     │
         ▼                     ▼
    /chat endpoint         /plan endpoint
         │                     │
         ▼                     ▼
    Conversational         Steps[] →
    Response               Execute
```

---

## 5-Week Timeline

| Week | Focus | Deliverable |
|------|-------|-------------|
| 1-2 | RAG Chat Mode | Conversational Q&A about page content |
| 3 | Screenshot Capture | Visual feedback, "see what AI sees" |
| 4 | Semantic Element Search | NL-based element finding |
| 5 | Polish & Demo | Impressive demo workflows |

---

## Week 1-2: RAG Chat Mode

**Goal:** Users can ask questions about the current page and get conversational answers.

### Backend Changes

#### New Endpoint: `/chat` or mode flag on `/plan`

```python
# New schema
class ChatRequest(BaseModel):
    user_message: str
    page_content: PageSnapshot  # Enhanced with full text
    provider: str = "anthropic"

class ChatResponse(BaseModel):
    response: str  # Conversational answer
    sources: list[str] = []  # Relevant page sections used
```

#### Enhanced Page Content Extraction

Current `PageSnapshot` has:
- url, title, text (truncated), candidates[]

Need to add:
- `full_text`: Complete page text content
- `structured_content`: Headers, paragraphs, lists with hierarchy
- `metadata`: Description, keywords, author if available

#### Intent Classifier

```python
def classify_intent(user_message: str) -> Literal["chat", "action"]:
    """
    Determine if user wants information or action.

    Action keywords: click, scroll, type, navigate, go to, open, fill
    Chat keywords: what, why, how, explain, summarize, tell me, is there
    """
    # Start with rule-based, upgrade to LLM if needed
```

#### New Planner Strategy: ChatPlanner

```python
class ChatPlanner(BasePlanner):
    """Generates conversational responses using page content as context."""

    async def generate_response(
        self,
        request: ChatRequest
    ) -> ChatResponse:
        # Build context from page content
        # Call LLM with RAG-style prompt
        # Return conversational response
```

### Frontend Changes

#### New Message Type

```typescript
interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  type: "chat" | "plan";  // NEW: distinguish chat from action plans
  timestamp: number;
}
```

#### UI Updates

- Chat messages render as conversation bubbles (not plan cards)
- Visual distinction between "answer" and "action plan" responses
- Optional: Show "sources" from page content used in answer

### Content Script Changes

#### Enhanced EXTRACT Command

```javascript
// Current: returns { url, title, text, candidates }
// New: returns { url, title, text, fullText, structuredContent, candidates }

function extractFullPageContent() {
  return {
    fullText: document.body.innerText,
    structuredContent: extractStructuredContent(),
    // ... existing fields
  };
}

function extractStructuredContent() {
  // Extract headings, paragraphs, lists with hierarchy
  // Preserve semantic structure for better RAG
}
```

### Files to Modify

| File | Changes |
|------|---------|
| `agent_server/app/schemas/requests.py` | Add ChatRequest, enhance PageSnapshot |
| `agent_server/app/schemas/responses.py` | Add ChatResponse |
| `agent_server/app/routers/plan.py` | Add /chat endpoint or mode handling |
| `agent_server/app/planner/strategies/` | Add chat_planner.py |
| `zen_extension/contentScript.js` | Enhanced EXTRACT with full content |
| `zen_extension/background.js` | Route chat vs action requests |
| `zen_extension/src/sidebar/types/` | Add chat message types |
| `zen_extension/src/sidebar/components/ChatMessage.tsx` | Render chat vs plan differently |
| `zen_extension/src/sidebar/hooks/useAgent.ts` | Handle chat responses |

---

## Week 3: Screenshot Capture

**Goal:** Capture and display what the agent "sees" for visual feedback.

### Content Script

```javascript
async function captureScreenshot() {
  // Use browser.tabs.captureVisibleTab() from background
  // Return base64 image data
}
```

### Background Script

```javascript
// New message type: SCREENSHOT
case "SCREENSHOT":
  const dataUrl = await browser.tabs.captureVisibleTab(null, {
    format: "png",
    quality: 80
  });
  return { screenshot: dataUrl };
```

### Frontend

- Display screenshot in sidebar
- Optional: Overlay with element highlights
- Click on screenshot to reference elements

### Backend (Optional)

- Send screenshot to vision model (GPT-4V, Claude Vision, Gemini)
- Get element descriptions from visual analysis
- Fallback when DOM extraction fails

### Files to Modify

| File | Changes |
|------|---------|
| `zen_extension/background.js` | Add SCREENSHOT handler |
| `zen_extension/src/sidebar/components/` | Add ScreenshotViewer.tsx |
| `zen_extension/src/sidebar/hooks/useAgent.ts` | Request/display screenshots |
| `agent_server/app/schemas/requests.py` | Optional: Add screenshot field |
| `agent_server/app/planner/strategies/` | Optional: Vision model integration |

---

## Week 4: Semantic Element Search

**Goal:** Find elements using natural language instead of brittle CSS selectors.

### Current Approach
```
User: "click the login button"
Agent: Matches "login" in candidates[], returns selector
Problem: Fails if text doesn't match exactly
```

### New Approach
```
User: "click the login button"
Agent:
  1. Get all interactive elements with context
  2. Use LLM to find best match for "login button"
  3. Return element reference
```

### Backend: Semantic Matcher

```python
class SemanticMatcher:
    """Use LLM to match user intent to page elements."""

    async def find_element(
        self,
        query: str,  # "login button"
        candidates: list[Candidate],
        page_context: str  # Surrounding text for disambiguation
    ) -> Candidate | None:
        # Build prompt with candidates
        # Ask LLM to select best match
        # Return matched candidate or None
```

### Enhanced Candidate Extraction

```javascript
// Current candidate:
{ selector: "button.login", text: "Log In" }

// Enhanced candidate:
{
  selector: "button.login",
  text: "Log In",
  role: "button",  // ARIA role
  context: "Sign in to your account...",  // Surrounding text
  location: "header",  // Page region
  attributes: { class: "btn-primary", id: "login-btn" }
}
```

### Files to Modify

| File | Changes |
|------|---------|
| `agent_server/app/planner/matcher.py` | Add SemanticMatcher class |
| `agent_server/app/schemas/requests.py` | Enhance Candidate schema |
| `zen_extension/contentScript.js` | Extract richer candidate metadata |

---

## Week 5: Polish & Demo

**Goal:** Make it look impressive for portfolio.

### Demo Workflows to Script

1. **RAG Demo**: Open a Wikipedia article, ask questions about it
2. **Action Demo**: Search for a product, add to cart
3. **Hybrid Demo**: "What's the cheapest option?" → AI answers → "Add it to cart" → AI acts

### UI Polish

- Smooth animations between states
- Loading states that don't look broken
- Error messages that are helpful
- Mobile-responsive sidebar (if applicable)

### Documentation

- GIF demos for README
- Clean architecture diagram
- Setup instructions that work first try

### Files to Create/Update

| File | Purpose |
|------|---------|
| `README.md` | Updated with new features, GIFs |
| `docs/DEMO_SCRIPT.md` | Step-by-step demo walkthrough |
| `docs/ARCHITECTURE.md` | Visual system diagram |

---

## Technical Decisions to Make

| Decision | Options | Recommendation |
|----------|---------|----------------|
| Page content for RAG | Full text vs structured DOM vs both | Both - structured for accuracy, full text for fallback |
| Intent classification | Rule-based vs LLM | Start rule-based, add LLM for ambiguous cases |
| Screenshot storage | In-memory vs temp files | In-memory (base64) for simplicity |
| Vision model | GPT-4V vs Claude Vision vs Gemini | Match selected provider (if using Anthropic, use Claude Vision) |
| Semantic search | Embed + vector search vs LLM ranking | LLM ranking (simpler, good enough for demo) |

---

## Success Criteria

### Week 2 Checkpoint
- [ ] Can ask "What is this page about?" and get coherent answer
- [ ] Chat responses render differently from action plans
- [ ] Intent classifier correctly routes 90%+ of inputs

### Week 3 Checkpoint
- [ ] Screenshot displays in sidebar
- [ ] Capture happens on demand or automatically

### Week 4 Checkpoint
- [ ] "Click the login button" works even if button says "Sign In"
- [ ] Semantic search handles 80%+ of element queries

### Week 5 Checkpoint
- [ ] 3 polished demo workflows working end-to-end
- [ ] README has GIFs showing features
- [ ] Someone else can set up and run the project

---

## Future Enhancements (Post-Demo)

| Feature | Priority | Notes |
|---------|----------|-------|
| Multi-tab workflows | High | Cross-tab data correlation |
| GIF recording | Medium | Record demos automatically |
| Console/Network inspection | Medium | Developer power features |
| Injection defense | High (for production) | Security hardening |
| Workflow shortcuts | Low | Save and replay sequences |
| Image upload | Low | Upload screenshots to forms |

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| LLM costs during development | Use rule-based fallback, cache responses |
| RAG responses are wrong/hallucinated | Show source snippets, add confidence indicator |
| Semantic search too slow | Limit candidates, use faster model (Haiku/GPT-4o-mini) |
| Demo breaks during presentation | Pre-record backup video, have scripted fallback sites |
