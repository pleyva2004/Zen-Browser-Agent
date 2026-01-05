// ===========================================
// State Management
// ===========================================

let planState = { steps: [], idx: 0, summary: "" };

// Circuit breaker state
const circuitBreaker = {
    failures: 0,
    lastFailure: null,
    isOpen: false,
    cooldownMs: 5 * 60 * 1000, // 5 minutes
    threshold: 3
};

// Connection status for UI
let connectionStatus = "disconnected"; // "disconnected" | "connecting" | "connected"

// ===========================================
// Logging Utilities
// ===========================================

function log(level, message, data = {}) {
    const timestamp = new Date().toISOString();
    const prefix = `[AGENT][${level.toUpperCase()}]`;
    console[level === "error" ? "error" : "log"](prefix, timestamp, message, data);
}

// ===========================================
// Core Functions
// ===========================================

async function getActiveTab() {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    return tab;
}

async function callContent(tabId, payload) {
    return browser.tabs.sendMessage(tabId, payload);
}

async function captureScreenshot() {
    try {
        return await browser.tabs.captureVisibleTab(null, { format: "png" });
    } catch (e) {
        log("warn", "Screenshot capture failed, continuing without", { error: e.message });
        return null;
    }
}

function isRiskyStep(step, pageSnapshot) {
    const riskyWords = ["pay", "checkout", "purchase", "order", "delete", "cancel", "unsubscribe", "send", "publish", "confirm"];
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

// ===========================================
// Circuit Breaker Logic
// ===========================================

function checkCircuitBreaker() {
    if (!circuitBreaker.isOpen) return true;

    const now = Date.now();
    if (now - circuitBreaker.lastFailure > circuitBreaker.cooldownMs) {
        log("info", "Circuit breaker reset after cooldown");
        circuitBreaker.isOpen = false;
        circuitBreaker.failures = 0;
        return true;
    }

    const remainingMs = circuitBreaker.cooldownMs - (now - circuitBreaker.lastFailure);
    const remainingSec = Math.ceil(remainingMs / 1000);
    throw new Error(`Agent server temporarily unavailable. Please try again in ${remainingSec} seconds.`);
}

function recordFailure() {
    circuitBreaker.failures++;
    circuitBreaker.lastFailure = Date.now();

    if (circuitBreaker.failures >= circuitBreaker.threshold) {
        circuitBreaker.isOpen = true;
        log("warn", "Circuit breaker opened after consecutive failures", { failures: circuitBreaker.failures });
    }
}

function recordSuccess() {
    circuitBreaker.failures = 0;
    circuitBreaker.isOpen = false;
}

// ===========================================
// Retry Logic with Exponential Backoff
// ===========================================

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchWithTimeout(url, options, timeoutMs = 30000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });
        return response;
    } finally {
        clearTimeout(timeoutId);
    }
}

async function callAgentServer(payload, maxRetries = 3) {
    checkCircuitBreaker();

    const delays = [1000, 2000, 4000]; // 1s, 2s, 4s
    let lastError = null;

    connectionStatus = "connecting";
    log("info", "Planning request", { userRequest: payload.userRequest, url: payload.page?.url });

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            const startTime = Date.now();

            const r = await fetchWithTimeout("http://127.0.0.1:8765/plan", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            }, 30000);

            const elapsed = Date.now() - startTime;

            if (!r.ok) {
                const errorText = await r.text().catch(() => "Unknown error");
                throw new Error(`Server returned ${r.status}: ${errorText}`);
            }

            const result = await r.json();

            connectionStatus = "connected";
            recordSuccess();
            log("info", "Planning succeeded", { elapsed, stepsCount: result.steps?.length });

            return result;

        } catch (e) {
            lastError = e;

            if (e.name === "AbortError") {
                log("warn", "Request timeout", { attempt: attempt + 1 });
                lastError = new Error("Request timed out after 30 seconds");
            } else {
                log("warn", "Request failed", { attempt: attempt + 1, error: e.message });
            }

            if (attempt < maxRetries - 1) {
                const delay = delays[attempt];
                log("info", `Retrying in ${delay}ms...`);
                await sleep(delay);
            }
        }
    }

    connectionStatus = "disconnected";
    recordFailure();

    // User-friendly error message
    if (lastError.message.includes("Failed to fetch") || lastError.message.includes("NetworkError")) {
        throw new Error("Cannot connect to agent server. Please ensure the server is running (python run.py).");
    }

    throw lastError;
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

// ===========================================
// Message Handler
// ===========================================

browser.runtime.onMessage.addListener(async (msg) => {
    try {
        // Connection status query
        if (msg.type === "GET_CONNECTION_STATUS") {
            return { status: connectionStatus };
        }

        // Health check - verify server is reachable
        if (msg.type === "CHECK_SERVER_HEALTH") {
            log("info", "Health check requested");
            try {
                const r = await fetchWithTimeout("http://127.0.0.1:8765/health", {}, 5000);

                if (r.ok) {
                    try {
                        const data = await r.json();
                        connectionStatus = "connected";
                        log("info", "Health check succeeded", { version: data.version, status: data.status });
                        return { healthy: true, version: data.version };
                    } catch (parseError) {
                        log("error", "Failed to parse health check response", { error: parseError.message });
                        connectionStatus = "disconnected";
                        return { healthy: false, error: "Invalid response format from server" };
                    }
                } else {
                    const errorText = await r.text().catch(() => `HTTP ${r.status}`);
                    log("warn", "Health check failed - server returned error", { status: r.status, error: errorText });
                    connectionStatus = "disconnected";
                    return { healthy: false, error: `Server returned error: HTTP ${r.status}` };
                }
            } catch (e) {
                const errorMessage = e instanceof Error ? e.message : String(e);
                log("error", "Health check failed - cannot reach server", { error: errorMessage });
                connectionStatus = "disconnected";
                return { healthy: false, error: `Cannot reach server: ${errorMessage}` };
            }
        }



        // Main planning request
        if (msg.type === "AGENT_REQUEST") {
            const tab = await getActiveTab();
            log("info", "Agent request received", { text: msg.text, tabUrl: tab?.url });

            // Check for restricted URLs
            if (!tab.url || tab.url.startsWith("about:") || tab.url.startsWith("moz-extension:") || tab.url.startsWith("view-source:") || tab.url.startsWith("chrome:")) {
                return { error: "I cannot run on this page. Please try a normal website (e.g. google.com)." };
            }

            const page = await callContent(tab.id, { tool: "EXTRACT" });
            log("info", "Page extracted", { url: page.url, candidatesCount: page.candidates?.length });

            const screenshotDataUrl = await captureScreenshot();

            const plan = await callAgentServer({
                userRequest: msg.text,
                page,
                screenshotDataUrl
            });

            planState = { steps: plan.steps || [], idx: 0, summary: plan.summary || "" };
            return { summary: planState.summary, steps: planState.steps, connectionStatus };
        }

        // Execute next step
        if (msg.type === "RUN_NEXT_STEP") {
            const tab = await getActiveTab();
            const page = await callContent(tab.id, { tool: "EXTRACT" });

            if (!planState.steps || planState.idx >= planState.steps.length) {
                return { done: true, message: "No steps left." };
            }

            const step = planState.steps[planState.idx];
            log("info", "Executing step", { idx: planState.idx, tool: step.tool, selector: step.selector });

            if (isRiskyStep(step, page)) {
                log("warn", "Blocked risky step", { step });
                return { error: "Blocked: risky step (login/checkout/delete/send/publish). Do this manually or refine request." };
            }

            const result = await executeStep(tab.id, step);
            const ranIndex = planState.idx;
            planState.idx += 1;

            if (!result?.ok && result?.error) {
                log("error", "Step execution failed", { ranIndex, error: result.error });
                return { ranIndex, error: result.error };
            }

            log("info", "Step executed successfully", { ranIndex, done: planState.idx >= planState.steps.length });
            return {
                ranIndex,
                message: step.note || `${step.tool} executed.`,
                done: planState.idx >= planState.steps.length
            };
        }
    } catch (e) {
        log("error", "Message handler error", { error: e.message, type: msg?.type });
        return { error: String(e?.message || e) };
    }
});
