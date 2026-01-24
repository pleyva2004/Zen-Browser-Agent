"""
Local LLM planner strategy.

Uses a local LLM (e.g., LM Studio, Ollama) to generate plans.
Useful for offline/private operation.

Supports OpenAI-compatible chat completions API format.
"""

import json
import os

import httpx

PERCEPTION_SYSTEM_PROMPT = """You are a PERCEPTION MODULE for a browser automation agent.

You will be given a single screenshot of the current browser tab.
Your job is to convert what you SEE into compact, reliable JSON that a separate planner model will use.

Hard rules:
- Output MUST be valid JSON ONLY (no markdown, no backticks, no commentary).
- Do NOT invent selectors, HTML, or code.
- If you are not sure about something, use null or \"unknown\". Do NOT guess.
- Keep it concise: prioritize what's relevant for automation (forms, buttons, errors, modals, blockers).
- Extract visible text exactly when possible (headings, button labels, error messages).

Return this JSON schema exactly:

{
  \"page_type\": \"unknown | login | signup | checkout | search | article | dashboard | settings | form | error | modal | captcha | file_upload | email | other\",
  \"primary_goal_state\": \"1-2 sentence description of what the user can do right now on this screen\",
  \"visible_headings\": [ \"...\" ],
  \"visible_key_text\": [ \"short important text snippets, alerts, prices, labels\" ],

  \"forms\": [
    {
      \"label_or_heading\": \"text near the form (e.g., Sign in, Shipping address)\",
      \"fields\": [
        {
          \"label\": \"Email\",
          \"placeholder\": \"name@example.com\",
          \"field_type\": \"text | email | password | search | number | textarea | unknown\",
          \"is_filled\": \"unknown | true | false\"
        }
      ]
    }
  ],

  \"clickable_targets\": [
    {
      \"type\": \"button | link | tab | menu | icon | checkbox | radio | dropdown | unknown\",
      \"text\": \"visible label (e.g., Sign in, Continue, Next, Accept)\",
      \"state\": \"unknown | enabled | disabled | selected\",
      \"notes\": \"only if needed: where it is / what it likely does\"
    }
  ],

  \"popups_modals\": [
    {
      \"title\": \"visible modal title\",
      \"body_text\": \"short summary\",
      \"blocking\": true
    }
  ],

  \"errors_warnings\": [
    {
      \"severity\": \"info | warning | error\",
      \"text\": \"exact error/warning text if visible\"
    }
  ],

  \"blockers\": [
    \"captcha\",
    \"cookie_banner\",
    \"paywall\",
    \"login_required\",
    \"two_factor\",
    \"rate_limit\",
    \"unknown\"
  ],

  \"suggested_next_actions\": [
    {
      \"intent\": \"click | type | select | dismiss | wait | navigate\",
      \"target_hint\": \"describe the target in human terms (e.g., click the 'Sign in' button, dismiss cookie banner, type into Email field)\",
      \"why\": \"short reason\"
    }
  ],

  \"uncertainties\": [ \"anything ambiguous or hard to read\" ],
  \"confidence\": 0.0
}
"""

from app.config import get_settings
from app.planner.base import BasePlanner
from app.planner.prompts.system import get_planning_prompt
from app.schemas import PlanRequest, PlanResponse, Step


class LocalPlanner(BasePlanner):
    """
    Planner using a local LLM.

    Connects to a local LLM API (e.g., LM Studio, Ollama) running on localhost.
    Uses OpenAI-compatible chat completions API format.
    Configure LOCAL_MODEL_URL and LOCAL_MODEL_NAME in environment.
    """

    def __init__(self):
        """Initialize the local LLM client."""
        settings = get_settings()
        self.url = settings.local_model_url
        self.model = settings.local_model_name
        # Optional: use a separate VLM for screenshot-based planning
        # Set LOCAL_VISION_MODEL_NAME in your environment (e.g., qwen2-vl-2b-instruct, qwen2.5-vl, llava, gemma-3 vision variant)
        self.vision_model = settings.vision_model_name
        self.client = httpx.AsyncClient(timeout=120.0)  # Longer timeout for local LLMs

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

            # Two-stage flow when a screenshot is available:
            # 1) VLM converts screenshot -> compact JSON observations
            # 2) Text-only reasoner (gpt-oss-20b) produces the plan using DOM candidates + observations
            # Visual intelligence disabled
            if request.screenshotDataUrl and False:
                if self.vision_model == self.model:
                    raise ValueError(
                        "Screenshot provided but LOCAL_VISION_MODEL_NAME is not set (or equals the text-only model). "
                        "Configure a vision-capable model in LM Studio and set LOCAL_VISION_MODEL_NAME to its model id."
                    )

                vision_observations_json = await self._perceive_screenshot(
                    screenshot_data_url=request.screenshotDataUrl,
                    user_goal=request.userRequest,
                    page_url=request.page.url,
                    page_title=request.page.title,
                )

                # Add the perception output to the planner context
                user_message = (
                    user_message
                    + "\n\nSCREENSHOT_OBSERVATIONS_JSON (from vision model; treat as ground truth when it conflicts with DOM text):\n"
                    + vision_observations_json
                )

            # Always send TEXT ONLY to the planner reasoner (no images) so text-only models work.
            user_content = user_message
            model_to_use = self.model

            # Use OpenAI-compatible chat completions format
            response = await self.client.post(
                self.url,
                json={
                    "model": model_to_use,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_content},
                    ],
                    "temperature": 0.3,  # Lower temp for more consistent JSON
                    "max_tokens": 4096,
                    "stream": False,
                },
            )
            response.raise_for_status()

            data = response.json()
            # Extract content from OpenAI-compatible response format
            content = data["choices"][0]["message"]["content"]
            return self._parse_response(content)

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

Generate a plan to achieve the user's goal or use the information provided to answer the user's question.
"""

    def _strip_code_fences(self, text: str) -> str:
        """Remove markdown code fences from a model response if present."""
        cleaned = (text or "").strip()
        if cleaned.startswith("```json"):
            cleaned = cleaned[7:]
        elif cleaned.startswith("```"):
            cleaned = cleaned[3:]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]
        return cleaned.strip()

    async def _perceive_screenshot(
        self,
        screenshot_data_url: str,
        user_goal: str,
        page_url: str,
        page_title: str,
    ) -> str:
        """Use a vision-language model to convert the screenshot into structured JSON observations."""
        # Keep the text instruction short to reduce token/latency costs.
        user_text = (
            f"User Goal: {user_goal}\n"
            f"Page URL: {page_url}\n"
            f"Page Title: {page_title}\n\n"
            "Analyze the screenshot and return ONLY the JSON described in the system instructions."
        )

        response = await self.client.post(
            self.url,
            json={
                "model": self.vision_model,
                "messages": [
                    {"role": "system", "content": PERCEPTION_SYSTEM_PROMPT},
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": user_text},
                            {"type": "image_url", "image_url": {"url": screenshot_data_url}},
                        ],
                    },
                ],
                "temperature": 0.2,
                "max_tokens": 1200,
                "stream": False,
            },
        )
        response.raise_for_status()

        data = response.json()
        content = data["choices"][0]["message"]["content"]
        cleaned = self._strip_code_fences(content)

        # Validate JSON; if the vision model returns invalid JSON, wrap it to avoid breaking the planner.
        try:
            parsed = json.loads(cleaned)
            return json.dumps(parsed, ensure_ascii=False)
        except Exception:
            return json.dumps({"raw": cleaned}, ensure_ascii=False)

    def _parse_response(self, text: str) -> PlanResponse:
        """Parse local LLM's response into a PlanResponse."""
        try:
            # Strip markdown code blocks if present
            cleaned = text.strip()
            if cleaned.startswith("```json"):
                cleaned = cleaned[7:]
            elif cleaned.startswith("```"):
                cleaned = cleaned[3:]
            if cleaned.endswith("```"):
                cleaned = cleaned[:-3]
            cleaned = cleaned.strip()

            data = json.loads(cleaned)

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

        except json.JSONDecodeError as e:
            return PlanResponse(
                summary=f"Failed to parse LLM response as JSON.",
                steps=[],
                error=f"Invalid JSON: {str(e)}. Raw response: {text[:200]}",
            )
