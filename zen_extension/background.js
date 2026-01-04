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

            // Check for restricted URLs
            if (!tab.url || tab.url.startsWith("about:") || tab.url.startsWith("moz-extension:") || tab.url.startsWith("view-source:") || tab.url.startsWith("chrome:")) {
                return { error: "I cannot run on this page. Please try a normal website (e.g. google.com)." };
            }

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
