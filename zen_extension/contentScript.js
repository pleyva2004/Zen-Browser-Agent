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
