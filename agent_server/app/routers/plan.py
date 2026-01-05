"""
Plan router.

Handles the POST /plan endpoint for generating execution plans.
"""

import logging
from fastapi import APIRouter, Depends, HTTPException

from app.config import Settings, get_settings
from app.planner.base import BasePlanner
from app.planner.factory import create_planner
from app.schemas import PlanRequest, PlanResponse

router = APIRouter(tags=["planning"])
logger = logging.getLogger(__name__)


@router.post("/plan", response_model=PlanResponse)
async def create_plan(
    request: PlanRequest,
    settings: Settings = Depends(get_settings),
) -> PlanResponse:
    """
    Generate an execution plan for the user's request.

    Takes a user goal and current page state, and returns a plan
    with steps to execute.

    The provider can be specified in the request body to override
    the default. If not specified, uses the default from settings.

    Implements graceful degradation: if an LLM provider fails,
    automatically falls back to rule_based planner.

    Args:
        request: The plan request with goal and page state.
        settings: Application settings (injected).

    Returns:
        PlanResponse with summary and steps.

    Raises:
        HTTPException: If provider is invalid or all planners fail.
    """
    # Determine provider
    provider = request.provider or settings.default_provider

    try:
        # Get planner
        planner = create_planner(provider)

        # Generate plan
        response = await planner.plan(request)

        # If response has an error and we're not already using rule_based,
        # try falling back to rule_based
        if response.error and provider != "rule_based":
            logger.warning(
                f"Provider {provider} failed with error: {response.error}. "
                "Falling back to rule_based planner."
            )
            return await _fallback_to_rule_based(request, response.error)

        return response

    except ValueError as e:
        # Invalid provider - no fallback
        raise HTTPException(status_code=400, detail=str(e))

    except Exception as e:
        # LLM provider failed - try fallback
        if provider != "rule_based":
            logger.warning(
                f"Provider {provider} raised exception: {str(e)}. "
                "Falling back to rule_based planner."
            )
            return await _fallback_to_rule_based(request, str(e))

        # Even rule_based failed - this is unexpected
        raise HTTPException(status_code=500, detail=f"Planning failed: {str(e)}")


async def _fallback_to_rule_based(request: PlanRequest, original_error: str) -> PlanResponse:
    """
    Fall back to rule_based planner when LLM providers fail.

    Args:
        request: The original plan request.
        original_error: Error message from the failed provider.

    Returns:
        PlanResponse from rule_based planner with fallback notice.
    """
    try:
        fallback_planner = create_planner("rule_based")
        response = await fallback_planner.plan(request)

        # Add notice about fallback if we got steps
        if response.steps:
            response.summary = f"[Fallback] {response.summary}"
        else:
            # Rule-based couldn't help either
            response.summary = (
                f"AI provider unavailable ({original_error}). "
                f"Try: 'search <term>', 'click <button text>', or 'scroll down'."
            )

        return response

    except Exception as e:
        # Even fallback failed
        logger.error(f"Fallback to rule_based also failed: {str(e)}")
        return PlanResponse(
            summary=f"All planners failed. Original error: {original_error}",
            steps=[],
            error=f"Fallback also failed: {str(e)}",
        )


@router.get("/providers")
async def list_providers(
    settings: Settings = Depends(get_settings),
) -> dict:
    """
    List available providers.

    Returns:
        Dict with available providers and current default.
    """
    return {
        "providers": ["rule_based", "anthropic", "openai", "gemini", "local"],
        "default": settings.default_provider,
    }