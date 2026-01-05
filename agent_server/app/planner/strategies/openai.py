"""
OpenAI GPT planner strategy.

Uses OpenAI's GPT models to generate intelligent plans
based on the user's goal and page context.
"""

import json

from openai import AsyncOpenAI

from app.config import get_settings
from app.planner.base import BasePlanner
from app.planner.prompts.system import get_planning_prompt
from app.schemas import PlanRequest, PlanResponse, Step


class OpenAIPlanner(BasePlanner):
    """
    Planner using OpenAI's GPT models.

    Requires OPENAI_API_KEY to be set in environment.
    """

    def __init__(self):
        """Initialize the OpenAI client."""
        settings = get_settings()
        if not settings.openai_api_key:
            raise ValueError("OPENAI_API_KEY is required for OpenAI planner")

        self.client = AsyncOpenAI(api_key=settings.openai_api_key)
        self.model = settings.openai_model

    async def plan(self, request: PlanRequest) -> PlanResponse:
        """
        Generate a plan using GPT.

        Args:
            request: The plan request.

        Returns:
            PlanResponse with generated steps.
        """
        try:
            system_prompt = get_planning_prompt()
            user_message = self._build_user_message(request)

            response = await self.client.chat.completions.create(
                model=self.model,
                max_tokens=1024,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_message},
                ],
                response_format={"type": "json_object"},
            )

            return self._parse_response(response.choices[0].message.content or "")

        except Exception as e:
            return PlanResponse(
                summary=f"OpenAI planning failed: {str(e)}",
                steps=[],
                error=str(e),
            )

    def _build_user_message(self, request: PlanRequest) -> str:
        """Build the user message with context."""
        candidates_str = "\n".join([
            f"- {c.tag}: selector='{c.selector}' text='{c.text}' "
            f"aria='{c.ariaLabel}' placeholder='{c.placeholder}'"
            for c in request.page.candidates[:30]
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
        """Parse GPT's response into a PlanResponse."""
        try:
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
            return PlanResponse(
                summary="Failed to parse GPT's response.",
                steps=[],
                error="Invalid JSON in response",
            )