"""
Local LLM planner strategy.

Uses a local LLM (e.g., Ollama) to generate plans.
Useful for offline/private operation.
"""

import json

import httpx

from app.config import get_settings
from app.planner.base import BasePlanner
from app.planner.prompts.system import get_planning_prompt
from app.schemas import PlanRequest, PlanResponse, Step


class LocalPlanner(BasePlanner):
    """
    Planner using a local LLM.

    Connects to a local LLM API (e.g., Ollama) running on localhost.
    Configure LOCAL_MODEL_URL and LOCAL_MODEL_NAME in environment.
    """

    def __init__(self):
        """Initialize the local LLM client."""
        settings = get_settings()
        self.url = settings.local_model_url
        self.model = settings.local_model_name
        self.client = httpx.AsyncClient(timeout=60.0)

    async def plan(self, request: PlanRequest) -> PlanResponse:
        """
        Generate a plan using local LLM.

        Args:
            request: The plan request.

        Returns:
            PlanResponse with generated steps.
        """
        try:
            system_prompt = get_planning_prompt()
            user_message = self._build_user_message(request)

            full_prompt = f"{system_prompt}\n\n{user_message}"

            response = await self.client.post(
                self.url,
                json={
                    "model": self.model,
                    "prompt": full_prompt,
                    "stream": False,
                    "format": "json",
                },
            )
            response.raise_for_status()

            data = response.json()
            return self._parse_response(data.get("response", ""))

        except Exception as e:
            return PlanResponse(
                summary=f"Local LLM planning failed: {str(e)}",
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
        """Parse local LLM's response into a PlanResponse."""
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
                summary="Failed to parse local LLM's response.",
                steps=[],
                error="Invalid JSON in response",
            )