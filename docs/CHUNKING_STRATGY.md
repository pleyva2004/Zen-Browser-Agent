# Chunking Strategy for Long Articles

This document describes how the Zen‑Browser‑Agent handles articles that exceed the 40 k character limit imposed by `visibleText()`. It covers three common patterns:

1. **Manual overlapping chunking** – slice the text into 10 k‑character blocks with a 1 k overlap.
2. **Hierarchical summarisation** – first summarise each chunk, then summarise the collection of summaries.
3. **Incremental follow‑up requests** – request additional chunks on demand, passing the previous summary as lightweight context.

All examples assume a background script that obtains the full body text via `document.body?.innerText` and sends it to the agent (FastAPI) using a JSON payload.

---
## 1. Manual Overlapping Chunking

```js
// Grab the raw body text – no 40 k limit here.
const raw = document.body?.innerText || "";

// Chunk configuration
const CHUNK_SIZE  = 10000; // 10 k characters per chunk
const OVERLAP     =  1000; // 1 k overlap for context

const chunks = [];
for (let i = 0; i < raw.length; i += CHUNK_SIZE - OVERLAP) {
    chunks.push(raw.slice(i, i + CHUNK_SIZE));
}

// Send each chunk to the LLM sequentially
for (const c of chunks) {
    const resp = await agentRequest({ text: c, mode: "summarise" });
    // store resp.summary for later use
}
```

**Why overlap?**  A hard cut can split a sentence or an entity name, giving the LLM less context. 1 k of overlap (≈ 160 words) usually covers the tail end of a sentence.

---
## 2. Hierarchical Summarisation

1. **First‑level** – summarise each 10 k chunk into a short paragraph (≈ 50–100 words).
2. **Second‑level** – concatenate all first‑level summaries and summarise again to produce the final article summary.

```js
// First‑level summaries
const firstLevel = [];
for (const c of chunks) {
    const r = await agentRequest({ text: c, mode: "summarise" });
    firstLevel.push(r.summary);
}

// Second‑level (overall) summary
const combined = firstLevel.join("\n");
const final    = await agentRequest({ text: combined, mode: "summarise" });
```

This approach keeps each LLM call within a modest token budget while still covering the entire article.

---
## 3. Incremental Follow‑Up Requests

When the user is reading an article interactively, you can request chunks only when needed.

```js
let i = 0;
const overallSummaries = [];
while (i < chunks.length) {
    const prevSummary = i > 0 ? overallSummaries[i-1] : null;
    const r = await agentRequest({
        text:   chunks[i],
        mode:   "summarise",
        context: prevSummary, // provide lightweight continuity
    });
    overallSummaries.push(r.summary);
    i++;
}
```

The `context` field is optional; if the LLM supports it, you can reduce token usage by giving it a short recap of what was summarised before.

---
## Choosing the Right Strategy
| Scenario | Recommended Pattern |
|----------|--------------------|
| Article < 40 k chars | Send once – no chunking |
| 40–200 k chars | Manual overlapping chunks + first‑level summarisation |
| > 200 k chars | Hierarchical summarisation (chunk → first‑level → second‑level) |
| Real‑time reading | Incremental follow‑up with context |

---
## Integration Notes
* The `agentRequest` function is a thin wrapper around the FastAPI `/plan` endpoint.  It should accept an object like `{ text, mode, context? }` and return the parsed JSON.
* Store intermediate summaries in a local array or IndexedDB if you need to persist across page loads.
* Ensure the LLM’s token limit is respected – a 10 k‑char chunk (~2–3 k tokens) may still be too large for some models.  If so, reduce `CHUNK_SIZE` to 5 k or 3 k.
* All text handling is performed in the background script; no UI changes are required.

---
## Example Workflow
1. User opens an article.
2. Background script captures `raw` via `document.body.innerText`.
3. If `raw.length > 40000`, perform **Strategy 2** (hierarchical summarisation).
4. Display the final summary in the sidebar chat.
5. If the user clicks “Read more about X”, the agent can send a new request for the relevant chunk or query an external API.

---
**Author:** Claude Code
**Date:** 2026‑01‑05