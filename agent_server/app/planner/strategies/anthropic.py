"""
Anthropic Claude planner strategy.

Uses Anthropic's Claude models to generate intelligent plans
based on the user's goal and page context.
"""

import json
from typing import Any

from anthropic import AsyncAnthropic

from app.config import get_settings
from app.planner.base import BasePlanner
from app.planner.prompts.system import get_planning_prompt
from app.schemas import PlanRequest, PlanResponse, Step


class AnthropicPlanner(BasePlanner):
    """
    Planner using Anthropic's Claude models.

    Sends the user's goal and page context to Claude,
    which returns a structured plan with steps to execute.

    Requires ANTHROPIC_API_KEY to be set in environment.
    """

    def __init__(self):
        """Initialize the Anthropic client."""
        settings = get_settings()
        if not settings.anthropic_api_key:
            raise ValueError("ANTHROPIC_API_KEY is required for Anthropic planner")

        self.client = AsyncAnthropic(api_key=settings.anthropic_api_key)
        self.model = settings.anthropic_model

    async def plan(self, request: PlanRequest) -> PlanResponse:
        """
        Generate a plan using Claude.

        Args:
            request: The plan request.

        Returns:
            PlanResponse with generated steps.
        """
        try:
            # Build the prompt
            system_prompt = get_planning_prompt()
            user_message = self._build_user_message(request)

            # Call Claude
            response = await self.client.messages.create(
                model=self.model,
                max_tokens=1024,
                system=system_prompt,
                messages=[
                    {"role": "user", "content": user_message}
                ],
            )

            # Parse response
            return self._parse_response(response.content[0].text)

        except Exception as e:
            return PlanResponse(
                summary=f"Anthropic planning failed: {str(e)}",
                steps=[],
                error=str(e),
            )

    def _build_user_message(self, request: PlanRequest) -> str:
        """Build the user message with context."""
        candidates_str = "\n".join([
            f"- {c.tag}: selector='{c.selector}' text='{c.text}' "
            f"aria='{c.ariaLabel}' placeholder='{c.placeholder}'"
            for c in request.page.candidates[:30]  # Limit to 30
        ])

        return f"""
User Goal: {request.userRequest}

Current Page:
- URL: {request.page.url}
- Title: {request.page.title}

Available Elements:
{candidates_str}

Generate a plan to achieve the user's goal.
"""

    def _parse_response(self, text: str) -> PlanResponse:
        """Parse Claude's response into a PlanResponse."""
        try:
            # Try to extract JSON from response
            # Claude might wrap it in markdown code blocks
            if "```json" in text:
                start = text.find("```json") + 7
                end = text.find("```", start)
                text = text[start:end].strip()
            elif "```" in text:
                start = text.find("```") + 3
                end = text.find("```", start)
                text = text[start:end].strip()

            data = json.loads(text)

            steps = [
                Step(
                    tool=s.get("tool", "CLICK"),
                    selector=s.get("selector"),
                    text=s.get("text"),
                    deltaY=s.get("deltaY"),
                    url=s.get("url"),
                    note=s.get("note"),
                )
                for s in data.get("steps", [])
            ]

            return PlanResponse(
                summary=data.get("summary", "Plan generated."),
                steps=steps,
            )

        except json.JSONDecodeError:
            # If JSON parsing fails, return error
            return PlanResponse(
                summary="Failed to parse Claude's response.",
                steps=[],
                error="Invalid JSON in response",
            )