from __future__ import annotations

from typing import List, Optional, Literal, Set
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

app = FastAPI(title="Zen Tab Agent Server", version="0.1.0")

# Local dev CORS. Tighten later.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

Tool = Literal["CLICK", "TYPE", "SCROLL", "NAVIGATE"]

class Candidate(BaseModel):
    selector: str
    tag: str
    text: str = ""
    ariaLabel: str = ""
    placeholder: str = ""
    name: str = ""
    type: str = ""
    href: str = ""

class PageSnapshot(BaseModel):
    url: str
    title: str
    text: str
    candidates: List[Candidate] = Field(default_factory=list)

class PlanRequest(BaseModel):
    userRequest: str
    page: PageSnapshot
    screenshotDataUrl: Optional[str] = None  # optional; ignored in MVP

class Step(BaseModel):
    tool: Tool
    selector: Optional[str] = None
    text: Optional[str] = None
    deltaY: Optional[int] = None
    url: Optional[str] = None
    note: Optional[str] = None  # explanation for you

class PlanResponse(BaseModel):
    summary: str
    steps: List[Step]

def best_match(cands: List[Candidate], include_tags: Set[str], keywords: List[str]) -> Optional[Candidate]:
    keywords_l = [k.lower().strip() for k in keywords if k and k.strip()]
    best = None
    best_score = -1

    for c in cands:
        if c.tag.lower() not in include_tags:
            continue

        hay = " ".join([
            c.text or "",
            c.ariaLabel or "",
            c.placeholder or "",
            c.name or "",
            c.href or "",
        ]).lower()

        score = 0
        for k in keywords_l:
            if k in hay:
                score += 2

        # prefer better-labeled controls
        if c.ariaLabel: score += 1
        if c.placeholder: score += 1
        if c.text: score += 1

        if score > best_score:
            best_score = score
            best = c

    return best

def rule_based_plan(req: PlanRequest) -> PlanResponse:
    goal = req.userRequest.strip()
    goal_l = goal.lower()
    page = req.page
    cands = page.candidates

    steps: List[Step] = []

    # "search <query>"
    if "search" in goal_l:
        idx = goal_l.find("search")
        query = goal[idx + len("search"):].strip(" :,-") or goal

        search_input = best_match(
            cands,
            include_tags={"input", "textarea"},
            keywords=["search", "q", "query", "find", "looking for"]
        )

        if search_input:
            steps.append(Step(tool="CLICK", selector=search_input.selector, note="Focus the search box"))
            steps.append(Step(tool="TYPE", selector=search_input.selector, text=query, note=f'Type: "{query}"'))

            submit_btn = best_match(
                cands,
                include_tags={"button", "a", "input"},
                keywords=["search", "submit", "go"]
            )
            if submit_btn:
                steps.append(Step(tool="CLICK", selector=submit_btn.selector, note="Submit search"))
            else:
                # Many sites submit on Enter; we'll just stop here.
                pass

            return PlanResponse(summary=f'Planned search for "{query}".', steps=steps)

    # "scroll down"
    if any(k in goal_l for k in ["scroll", "go down", "down"]):
        steps.append(Step(tool="SCROLL", deltaY=900, note="Scroll down"))
        return PlanResponse(summary="Scrolling.", steps=steps)

    # "click <thing>"
    if goal_l.startswith("click "):
        target = goal[6:].strip()
        btn = best_match(cands, include_tags={"button", "a"}, keywords=[target])
        if btn:
            steps.append(Step(tool="CLICK", selector=btn.selector, note=f'Click something matching "{target}"'))
            return PlanResponse(summary=f'Clicking "{target}".', steps=steps)

    return PlanResponse(
        summary="No confident automation plan. Try: 'search <term>', 'click <button text>', or 'scroll down'.",
        steps=[]
    )

@app.post("/plan", response_model=PlanResponse)
def plan(req: PlanRequest) -> PlanResponse:
    # Later: replace rule_based_plan with an LLM planner that outputs the same schema.
    return rule_based_plan(req)
