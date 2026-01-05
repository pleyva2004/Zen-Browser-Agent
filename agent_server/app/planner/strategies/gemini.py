"""
Google Gemini planner strategy.

Uses Google's Gemini models to generate intelligent plans
based on the user's goal and page context.
"""

import json

import google.genai as genai

from app.config import get_settings
from app.planner.base import BasePlanner
from app.planner.prompts.system import get_planning_prompt
from app.schemas import PlanRequest, PlanResponse, Step


class GeminiPlanner(BasePlanner):
    """
    Planner using Google's Gemini models.

    Requires GEMINI_API_KEY to be set in environment.
    """

    def __init__(self):
        """Initialize the Gemini client."""
        settings = get_settings()
        if not settings.gemini_api_key:
            raise ValueError("GEMINI_API_KEY is required for Gemini planner")

        self.client = genai.Client(api_key=settings.gemini_api_key)
        self.model_name = settings.gemini_model

    async def plan(self, request: PlanRequest) -> PlanResponse:
        """
        Generate a plan using Gemini.

        Args:
            request: The plan request.

        Returns:
            PlanResponse with generated steps.
        """
        try:
            system_prompt = get_planning_prompt()
            user_message = self._build_user_message(request)

            full_prompt = f"{system_prompt}\n\n{user_message}"

            # Gemini doesn't have native async, run in executor
            response = await self._generate_async(full_prompt)

            return self._parse_response(response)

        except Exception as e:
            return PlanResponse(
                summary=f"Gemini planning failed: {str(e)}",
                steps=[],
                error=str(e),
            )

    async def _generate_async(self, prompt: str) -> str:
        """Generate content asynchronously."""
        import asyncio
        loop = asyncio.get_event_loop()

        # Use the new google.genai API
        def generate():
            response = self.client.models.generate_content(
                model=self.model_name,
                contents=prompt
            )
            # The new API may return text differently - try common patterns
            if hasattr(response, 'text'):
                return response.text
            elif hasattr(response, 'candidates') and len(response.candidates) > 0:
                return response.candidates[0].content.parts[0].text
            else:
                return str(response)

        response_text = await loop.run_in_executor(None, generate)
        return response_text

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
        """Parse Gemini's response into a PlanResponse."""
        try:
            # Extract JSON from response
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
            return PlanResponse(
                summary="Failed to parse Gemini's response.",
                steps=[],
                error="Invalid JSON in response",
            )
