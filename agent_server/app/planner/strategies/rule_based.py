"""
Rule-based planner strategy.

A heuristic planner that uses keyword matching to generate plans.
This is the fallback planner that works without any LLM API keys.
"""

from typing import List

from app.planner.base import BasePlanner
from app.planner.matcher import (
    best_match,
    find_clickable,
    find_search_input,
    find_submit_button,
)
from app.schemas import PlanRequest, PlanResponse, Step


class RuleBasedPlanner(BasePlanner):
    """
    Heuristic planner using keyword matching.

    Supports the following commands:
    - "search <query>" - Types query into search box
    - "scroll down" / "go down" - Scrolls the page
    - "click <target>" - Clicks a button/link matching target

    This planner does not require any API keys and works offline.
    """

    async def plan(self, request: PlanRequest) -> PlanResponse:
        """
        Generate a plan using rule-based heuristics.

        Args:
            request: The plan request.

        Returns:
            PlanResponse with generated steps.
        """
        goal = request.userRequest.strip()
        goal_lower = goal.lower()
        page = request.page
        candidates = page.candidates

        steps: List[Step] = []

        # Handle "search <query>" pattern
        if "search" in goal_lower:
            return self._handle_search(goal, goal_lower, candidates)

        # Handle "scroll down" / "go down" pattern
        if any(k in goal_lower for k in ["scroll", "go down", "down"]):
            return self._handle_scroll()

        # Handle "click <target>" pattern
        if goal_lower.startswith("click "):
            return self._handle_click(goal, candidates)

        # No pattern matched
        return PlanResponse(
            summary="No confident automation plan. Try: 'search <term>', 'click <button text>', or 'scroll down'.",
            steps=[],
        )

    def _handle_search(
        self,
        goal: str,
        goal_lower: str,
        candidates: list,
    ) -> PlanResponse:
        """Handle search command."""
        # Extract query from goal
        idx = goal_lower.find("search")
        query = goal[idx + len("search"):].strip(" :,-") or goal

        # Find search input
        search_input = find_search_input(candidates)

        if not search_input:
            return PlanResponse(
                summary=f"Could not find a search input on this page.",
                steps=[],
            )

        steps: List[Step] = []

        # Click to focus
        steps.append(Step(
            tool="CLICK",
            selector=search_input.selector,
            note="Focus the search box",
        ))

        # Type query
        steps.append(Step(
            tool="TYPE",
            selector=search_input.selector,
            text=query,
            note=f'Type: "{query}"',
        ))

        # Try to find submit button
        submit_btn = find_submit_button(candidates)
        if submit_btn:
            steps.append(Step(
                tool="CLICK",
                selector=submit_btn.selector,
                note="Submit search",
            ))

        return PlanResponse(
            summary=f'Planned search for "{query}".',
            steps=steps,
        )

    def _handle_scroll(self) -> PlanResponse:
        """Handle scroll command."""
        return PlanResponse(
            summary="Scrolling down.",
            steps=[Step(
                tool="SCROLL",
                deltaY=900,
                note="Scroll down",
            )],
        )

    def _handle_click(self, goal: str, candidates: list) -> PlanResponse:
        """Handle click command."""
        target = goal[6:].strip()  # Remove "click " prefix

        btn = find_clickable(candidates, target)

        if not btn:
            return PlanResponse(
                summary=f'Could not find element matching "{target}".',
                steps=[],
            )

        return PlanResponse(
            summary=f'Clicking "{target}".',
            steps=[Step(
                tool="CLICK",
                selector=btn.selector,
                note=f'Click something matching "{target}"',
            )],
        )
