// ===========================================
// Constants
// ===========================================
const MIN_VISIBLE_SIZE = 6;
const MAX_SELECTOR_DEPTH = 4;
const DEFAULT_WAIT_MS = 5000;
const RETRY_INTERVAL_MS = 100;
const CLICK_TIMEOUT_MS = 2000; // Not used directly, but kept for clarity
const INTERACT_DELAY_MS = 50;
const SCROLL_DEFAULT_DELTA = 700;
const MAX_VISIBLE_TEXT_LENGTH = 40000;
const MAX_CANDIATES = 60;

// ===========================================
// Visibility and Validation Utilities
// ===========================================
/**
 * Checks if an element is visible in the viewport and has non-zero dimensions.
 * @param {Element} el - The DOM element to check.
 * @returns {boolean} True if visible, false otherwise.
 */
function isVisible(el) {
    if (!el) return false;
    const boundingRect = el.getBoundingClientRect();
    if (boundingRect.width < MIN_VISIBLE_SIZE || boundingRect.height < MIN_VISIBLE_SIZE) return false;
    if (boundingRect.bottom < 0 || boundingRect.right < 0) return false;
    if (boundingRect.top > window.innerHeight || boundingRect.left > window.innerWidth) return false;
    const style = window.getComputedStyle(el);
    return style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0";
}

/**
 * Determines if an element can be interacted with (visible, not disabled, pointer events enabled).
 * @param {Element} el - The DOM element to check.
 * @returns {boolean} True if interactable, false otherwise.
 */
function isInteractable(el) {
    if (!el) return false;
    if (!isVisible(el)) return false;
    const style = window.getComputedStyle(el);
    return style.pointerEvents !== "none" && !el.disabled;
}

/**
 * Escapes CSS selector special characters.
 * @param {string} s - The string to escape.
 * @returns {string} Escaped selector string.
 */
function cssEscape(s) {
    return String(s).replace(/([ #;?%&,.+*~\':"!^$[\]()=>|\/@])/g, "\\$1");
}

// ===========================================
// Selector Generation
// ===========================================
/**
 * Generates a unique CSS selector for an element based on id, name, aria-label, placeholder or ancestry.
 * @param {Element} el - The target element.
 * @returns {string} CSS selector string.
 */
function selectorFor(el) {
    if (el.id) return `#${cssEscape(el.id)}`;

    const name = el.getAttribute("name");
    if (name) return `${el.tagName.toLowerCase()}[name="${name.replace(/"/g, '\\"')}"]`;

    const aria = el.getAttribute("aria-label");
    if (aria) return `${el.tagName.toLowerCase()}[aria-label="${aria.replace(/"/g, '\\"')}"]`;

    const placeholder = el.getAttribute("placeholder");
    if (placeholder) return `${el.tagName.toLowerCase()}[placeholder="${placeholder.replace(/"/g, '\\"')}"]`;

    let currentEl = el;
    const selectorParts = [];
    for (let depthIndex = 0; depthIndex < MAX_SELECTOR_DEPTH && currentEl && currentEl.nodeType === 1; depthIndex++) {
        const tag = currentEl.tagName.toLowerCase();
        const parent = currentEl.parentElement;
        if (!parent) break;
        const siblings = Array.from(parent.children).filter(x => x.tagName === currentEl.tagName);
        const idx = siblings.indexOf(currentEl) + 1;
        selectorParts.unshift(`${tag}:nth-of-type(${idx})`);
        currentEl = parent;
    }
    return selectorParts.join(" > ");
}

// ===========================================
// DOM Extraction
// ===========================================
/**
 * Extracts interactive candidate elements from the page.
 * @returns {Array<Object>} Array of candidate metadata objects.
 */
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

        if (out.length >= MAX_CANDIATES) break;
    }
    return out;
}

/**
 * Retrieves visible text from the document body.
 * @returns {string} Visible text up to a maximum length.
 */
function visibleText() {
    return (document.body?.innerText || "").slice(0, MAX_VISIBLE_TEXT_LENGTH);
}

// ===========================================
// Element Query with Retry
// ===========================================
/**
 * Waits for an element matching the selector to appear and become visible.
 * @param {string} selector - CSS selector string.
 * @param {number} [timeoutMs=DEFAULT_WAIT_MS] - Maximum wait time in ms.
 * @returns {Promise<Element|null>} The element or null if not found.
 */
async function waitForElement(selector, timeoutMs = DEFAULT_WAIT_MS) {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
        const el = document.querySelector(selector);
        if (el && isVisible(el)) {
            return el;
        }
        await new Promise(resolve => setTimeout(resolve, RETRY_INTERVAL_MS));
    }

    return null;
}

/**
 * Queries an element without retry.
 * @param {string} selector - CSS selector string.
 * @returns {{ok: boolean, element?: Element, error?: string}} Result object.
 */
function queryElement(selector) {
    const el = document.querySelector(selector);
    if (!el) {
        return { ok: false, error: `Element not found: ${selector}` };
    }
    if (!isVisible(el)) {
        return { ok: false, error: `Element not visible: ${selector}` };
    }
    return { ok: true, element: el };
}

// ===========================================
// Helper for interactable elements
// ===========================================
/**
 * Finds an element that is visible and interactable, waiting up to a timeout.
 * @param {string} selector - CSS selector string.
 * @param {number} [timeoutMs=DEFAULT_WAIT_MS] - Maximum wait time in ms.
 * @returns {Promise<Element|null>} The element or null if not found/interactive.
 */
async function findInteractable(selector, timeoutMs = DEFAULT_WAIT_MS) {
    let el = document.querySelector(selector);
    if (!el || !isVisible(el)) {
        el = await waitForElement(selector, timeoutMs);
    }
    if (!el) return null;
    if (!isInteractable(el)) return null;
    return el;
}

// ===========================================
// DOM Interactions
// ===========================================
/**
 * Clicks an element identified by selector.
 * @param {string} selector - CSS selector string.
 * @returns {Promise<{ok: boolean, error?: string}>} Result object.
 */
async function clickSelector(selector) {
    const el = await findInteractable(selector, CLICK_TIMEOUT_MS);

    if (!el) {
        return { ok: false, error: `Element not found or interactable: ${selector}` };
    }

    el.scrollIntoView({ behavior: "instant", block: "center" });
    await new Promise(resolve => setTimeout(resolve, INTERACT_DELAY_MS));

    el.click();
    return { ok: true };
}

/**
 * Types text into an input element identified by selector.
 * @param {string} selector - CSS selector string.
 * @param {string} text - Text to type.
 * @returns {Promise<{ok: boolean, error?: string}>} Result object.
 */
async function typeSelector(selector, text) {
    const el = await findInteractable(selector, CLICK_TIMEOUT_MS);

    if (!el) {
        return { ok: false, error: `Element not found or interactable: ${selector}` };
    }

    el.scrollIntoView({ behavior: "instant", block: "center" });
    await new Promise(resolve => setTimeout(resolve, INTERACT_DELAY_MS));

    el.focus();
    el.value = "";
    el.value = text;

    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));

    el.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true }));
    el.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true }));

    return { ok: true };
}

/**
 * Scrolls the window by a specified vertical amount.
 * @param {number} deltaY - Vertical scroll distance.
 * @returns {{ok: boolean}} Result object.
 */
function scrollByAmount(deltaY) {
    window.scrollBy({ top: deltaY, left: 0, behavior: "smooth" });
    return { ok: true };
}

// ===========================================
// Message Handler
// ===========================================
browser.runtime.onMessage.addListener(async (msg) => {
    try {
        if (msg.tool === "EXTRACT") {
            return {
                url: location.href,
                title: document.title,
                text: visibleText(),
                candidates: extractCandidates()
            };
        }
        if (msg.tool === "CLICK") {
            return await clickSelector(msg.selector);
        }
        if (msg.tool === "TYPE") {
            return await typeSelector(msg.selector, msg.text || "");
        }
        if (msg.tool === "SCROLL") {
            return scrollByAmount(msg.deltaY || SCROLL_DEFAULT_DELTA);
        }
        return { ok: false, error: "Unknown tool in content script." };
    } catch (e) {
        return { ok: false, error: `Content script error: ${e.message}` };
    }
});
