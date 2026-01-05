"""
FastAPI dependency injection.

Provides dependencies for routes to inject settings, planners, etc.
"""

from fastapi import Depends, Request

from app.config import Settings, get_settings
from app.planner.base import BasePlanner
from app.planner.factory import create_planner
from app.schemas import PlanRequest, Provider


async def get_planner_for_request(
    request: PlanRequest,
    settings: Settings = Depends(get_settings),
) -> BasePlanner:
    """
    Get the appropriate planner for a request.

    Uses the provider specified in the request, or falls back
    to the default provider from settings.

    Args:
        request: The plan request (contains optional provider override).
        settings: Application settings.

    Returns:
        A BasePlanner instance.
    """
    provider = request.provider or settings.default_provider
    return create_planner(provider)