# Zen Tab Agent - Product Requirements Document

## Vision

A conversational assistant that lives in your browser sidebar and automates repetitive web tasks through natural language commands.

## Problem Statement

Users spend significant time on repetitive browser tasks:
- Clicking through the same navigation paths daily
- Filling out similar forms repeatedly
- Scrolling through long pages to find specific content
- Performing multi-step workflows manually

These tasks are tedious, error-prone, and break focus from actual work.

## Solution

Zen Tab Agent provides a chat interface in the browser sidebar where users can describe what they want to accomplish in plain English. The agent observes the current page and executes the necessary actions (clicks, typing, scrolling) on their behalf.

## Target Users

**Primary:** Power users and knowledge workers who:
- Spend 4+ hours daily in their browser
- Perform repetitive workflows across web applications
- Value efficiency and keyboard-driven interfaces
- Use Zen Browser (Firefox-based)

**Secondary:** Developers and technical users who want to automate browser testing or demos.

## Key Features

### 1. Conversational Commands
Users type natural language instructions like:
- "Search for quarterly reports"
- "Click the Settings button"
- "Scroll to the bottom of the page"
- "Type my email address in the login form"

### 2. Sidebar Integration
- Always accessible via keyboard shortcut (Cmd/Ctrl+B)
- Doesn't interrupt the current page or require tab switching
- Persistent across browsing sessions

### 3. Step-by-Step Execution
- Agent shows a plan before executing
- User approves each step ("Run next" button)
- Maintains human oversight and control
- Can stop or modify at any point

### 4. Safety Guardrails
The agent refuses to:
- Interact with payment/checkout pages
- Fill password or 2FA fields
- Perform destructive actions (delete, unsubscribe, send)
- Execute without user confirmation

## User Experience

### Happy Path Flow

1. User opens sidebar with Cmd+B
2. User types: "Find the contact form and fill in my name"
3. Agent responds with a plan:
   - Step 1: Click "Contact" link
   - Step 2: Type "John Doe" in name field
4. User clicks "Run next" to execute Step 1
5. Page navigates to contact form
6. User clicks "Run next" to execute Step 2
7. Name field is filled
8. User continues or types new command

### Error Handling

- If an element isn't found: Agent explains and suggests alternatives
- If action fails: Agent stops and reports the issue
- If page changes unexpectedly: Agent re-observes before next step

## Success Metrics

| Metric | Target |
|--------|--------|
| Task completion rate | >80% of attempted tasks succeed |
| Time saved per task | >50% reduction vs. manual |
| User retention (weekly active) | >40% after 4 weeks |
| Safety incidents | 0 unintended destructive actions |

## Scope

### In Scope (v1)
- Single-tab automation only
- Four core actions: click, type, scroll, navigate
- Text-based page observation
- Manual step-by-step execution

### Out of Scope (v1)
- Multi-tab workflows
- Scheduled/recurring tasks
- Visual element recognition (screenshots)
- Fully autonomous execution
- Cross-browser support

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Agent clicks wrong element | Medium | Step-by-step approval, clear element descriptions |
| User trusts agent with sensitive actions | High | Hard-coded safety blocks, clear warnings |
| Agent can't understand complex commands | Medium | Graceful fallback, helpful error messages |
| Performance lag disrupts browsing | Low | Lightweight sidebar, async operations |

## Future Considerations

- **Voice commands**: Hands-free browser control
- **Workflow recording**: Learn from user demonstrations
- **Cross-tab orchestration**: Multi-tab automation
- **Shared workflows**: Export and share automation scripts
- **Visual understanding**: Screenshot-based element detection

## Open Questions

1. How do we handle dynamic/SPA pages where elements load asynchronously?
2. Should we allow users to save and replay common command sequences?
3. What's the right balance between autonomy and user control?
4. How do we communicate agent limitations without frustrating users?
