"""
Plan router.

Handles the POST /plan endpoint for generating execution plans.
"""

import logging
from typing import Optional
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException

from app.config import Settings, get_settings, Provider
from app.planner.factory import create_planner
from app.schemas import PlanRequest, PlanResponse, PageSnapshot

router = APIRouter(tags=["planning"])
logger = logging.getLogger(__name__)


class TestProviderRequest(BaseModel):
    """Request body for testing a provider."""
    provider: Provider


class TestProviderResponse(BaseModel):
    """Response from testing a provider."""
    success: bool
    provider: str
    error: Optional[str] = None


@router.post("/plan", response_model=PlanResponse)
async def create_plan( request: PlanRequest, settings: Settings = Depends(get_settings) ) -> PlanResponse:
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

    print("Inside of API REQUEST")
    print(f"Provider being used: {provider}")
    print("userRequest:", request.userRequest)
    print("page URL:", request.page.url)
    print("page text:", request.page.text)



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
async def list_providers( settings: Settings = Depends(get_settings) ) -> dict:
    """
    List available providers.

    Returns:
        Dict with available providers and current default.
    """
    return {
        "providers": ["rule_based", "anthropic", "openai", "gemini", "local"],
        "default": settings.default_provider,
    }


@router.post("/test-provider", response_model=TestProviderResponse)
async def test_provider(request: TestProviderRequest) -> TestProviderResponse:
    """
    Test a provider with a simple prompt to verify it's working.

    Sends a minimal request to the provider to check:
    - API key is valid
    - Model is accessible
    - Provider can generate a response

    Args:
        request: Contains the provider name to test.
        settings: Application settings (injected).

    Returns:
        TestProviderResponse with success status and any error message.
    """
    provider = request.provider
    logger.info(f"Testing provider: {provider}")

    try:
        # Get the planner for this provider
        planner = create_planner(provider)

        # Create a minimal test request
        test_request = PlanRequest(
            userRequest="Respond with the word OK",
            page=PageSnapshot(
                url="https://test.example.com",
                title="Test Page",
                text="",
                candidates=[]
            )
        )

        # Try to generate a plan
        response = await planner.plan(test_request)

        # Check if we got a valid response
        if response.error:
            logger.warning(f"Provider {provider} test failed: {response.error}")
            return TestProviderResponse(
                success=False,
                provider=provider,
                error=response.error
            )

        logger.info(f"Provider {provider} test succeeded")
        return TestProviderResponse(
            success=True,
            provider=provider
        )

    except ValueError as e:
        # Invalid provider name
        logger.error(f"Invalid provider {provider}: {str(e)}")
        return TestProviderResponse(
            success=False,
            provider=provider,
            error=f"Invalid provider: {str(e)}"
        )

    except Exception as e:
        # Provider failed
        logger.error(f"Provider {provider} test error: {str(e)}")
        return TestProviderResponse(
            success=False,
            provider=provider,
            error=str(e)
        )
