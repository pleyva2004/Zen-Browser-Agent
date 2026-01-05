## Frontend-Backend Integration Plan

Based on your confirmation that the backend server is running and API keys are configured, here's a focused plan to ensure robust frontend-backend integration with error handling built-in.

## Phase 1: Connection Verification (Read-Only Analysis)

**Goal:** Confirm current integration status without making changes.

### 1.1 Verify Backend Accessibility
- Confirm `GET http://127.0.0.1:8000/health` returns `{"status": "healthy", "version": "0.2.0"}`
- Confirm `GET http://127.0.0.1:8000/providers` returns available providers including your configured LLM providers
- Test `/plan` endpoint with a simple request to verify API contract

### 1.2 Analyze Current Data Flow
- Review `background.js: callAgentServer()` function for HTTP request implementation
- Verify `PlanRequest` schema in backend matches data sent from extension
- Check `PlanResponse` format matches frontend `types/plan.ts` expectations
- Confirm content script extraction produces valid `Candidate` objects

## Phase 2: Robust Error Handling Implementation

**Goal:** Add comprehensive error handling with graceful degradation.

### 2.1 Backend Connection Resilience
**Location:** `zen_extension/background.js: callAgentServer()`

- Add retry logic: 3 attempts with 1s, 2s, 4s delays
- Add timeout: 30-second limit per request
- Add circuit breaker: After 3 consecutive failures, disable agent for 5 minutes
- Return user-friendly errors: "Agent server temporarily unavailable" vs raw HTTP errors

### 2.2 Provider-Specific Error Handling
**Location:** Backend planner strategies

- Add API key validation on planner initialization
- Handle rate limits with exponential backoff
- Provide specific error messages: "Anthropic API key invalid" vs generic "Planning failed"
- Fallback to rule-based planner when LLM providers fail

### 2.3 Content Script Reliability
**Location:** `zen_extension/contentScript.js`

- Add timeout for DOM queries (5 seconds)
- Handle dynamic content loading (retry selector after 1s if not found)
- Validate element visibility before interaction
- Return structured errors: `{ok: false, error: "Element not found: #selector"}`

### 2.4 Frontend Error States
**Location:** `zen_extension/src/sidebar/hooks/useAgent.ts`

- Add connection status indicator (connecting/connected/disconnected)
- Handle partial failures (e.g., screenshot fails but plan succeeds)
- Provide actionable error messages with recovery suggestions
- Add "Retry" buttons for failed operations

## Phase 3: Integration Testing

**Goal:** Systematically test all connection points.

### 3.1 Unit Tests (Backend)
- Test planner factory with invalid providers
- Test schema validation with malformed requests
- Test error responses for missing API keys

### 3.2 Integration Tests (Extension)
- Test full flow: sidebar → background → backend → response
- Test error scenarios: server offline, invalid selectors, restricted URLs
- Test concurrent requests (should queue or reject)

### 3.3 End-to-End Tests
- Load extension in browser
- Navigate to test page (google.com)
- Submit "search for cats" request
- Verify plan generation and step execution
- Test error cases (server restart, API key issues)

## Phase 4: Monitoring & Observability

**Goal:** Built-in debugging and health monitoring.

### 4.1 Logging Infrastructure
**Location:** `zen_extension/background.js`

- Add structured logging: `console.log("[AGENT]", "Planning request:", {text, timestamp})`
- Log all API calls with timing
- Log errors with context (tab URL, user request, step details)

### 4.2 Health Endpoints
**Location:** Backend `/health` endpoint

- Add detailed health check: verify API keys, test LLM connectivity
- Return provider status: `{"anthropic": "healthy", "openai": "key_missing"}`
- Include version and uptime information

### 4.3 Debug Mode
**Location:** Extension manifest and background script

- Add debug flag in manifest.json for development builds
- Enable verbose logging in debug mode
- Add browser dev tools integration for inspecting messages

## Phase 5: Production Readiness

**Goal:** Ensure reliable operation in real usage.

### 5.1 Graceful Degradation
- Always fallback to rule-based planner if AI providers fail
- Continue working with partial page data (no screenshot)
- Handle browser tab changes mid-execution

### 5.2 User Experience
- Loading states for all async operations
- Progress indicators for multi-step plans
- Clear error recovery (retry buttons, alternative suggestions)

### 5.3 Performance Optimization
- Cache successful selectors for repeated interactions
- Lazy load content script only when needed
- Optimize screenshot compression (reduce quality for faster transfer)

## Implementation Priority

1. **High Priority:** Connection resilience (retries, timeouts)
2. **High Priority:** User-friendly error messages
3. **Medium Priority:** Comprehensive logging
4. **Medium Priority:** Fallback mechanisms
5. **Low Priority:** Performance optimizations

## Risk Mitigation

- **Server Offline:** Retry with backoff, show clear error message
- **API Key Issues:** Validate on startup, provide setup instructions
- **Page Changes:** Re-extract data before each step execution
- **Browser Updates:** Test across Zen Browser versions

This plan focuses on robust error handling while maintaining the existing architecture. The integration should work reliably out of the box with clear feedback when issues occur.

## Concrete Deliverables

### Phase 1: Connection Verification ✅
- [ ] Backend health check endpoint responds correctly
- [ ] Provider listing endpoint shows configured LLM providers
- [ ] Test plan generation with "search for cats" request
- [ ] Data flow analysis completed and documented

### Phase 2: Robust Error Handling Implementation
- [x] `callAgentServer()` function with 3-attempt retry logic and 30s timeout
- [x] Circuit breaker pattern implemented in background script
- [x] API key validation on planner initialization
- [x] Rate limit handling with exponential backoff in all LLM planners
- [x] Content script timeout (5s) for DOM queries
- [x] Element visibility validation before interactions
- [x] Connection status indicator in frontend UI
- [x] "Retry" buttons for failed operations



### Phase 3: Integration Testing
- [ ] Backend unit tests for error scenarios (invalid providers, malformed requests)
- [ ] Extension integration tests for message passing and error handling
- [ ] End-to-end test suite for full user flow
- [ ] Concurrent request handling validation

### Phase 4: Monitoring & Observability
- [ ] Structured logging added to background.js with timestamps
- [ ] Enhanced `/health` endpoint with provider status
- [ ] Debug mode flag in manifest.json
- [ ] Browser dev tools integration for message inspection

### Phase 5: Production Readiness
- [ ] Graceful degradation to rule-based planner when AI fails
- [ ] Loading states for all async operations
- [ ] Progress indicators for multi-step plan execution
- [ ] Selector caching for performance optimization
- [ ] Screenshot compression optimization

### Success Criteria
- [ ] Zero unhandled errors in production
- [ ] Clear error messages for all failure scenarios
- [ ] 99% success rate for valid user requests
- [ ] <2 second response time for planning requests
- [ ] Graceful handling of all edge cases (server offline, invalid data, etc.)

Would you like me to proceed with implementation of any specific phase, or do you have questions about the approach?
