"""
Planner factory.

Creates the appropriate planner instance based on the provider name.
Uses the Factory pattern for clean planner instantiation.
"""

from functools import lru_cache
from typing import Optional, Dict, Type

from app.config import get_settings
from app.planner.base import BasePlanner
from app.planner.strategies.anthropic import AnthropicPlanner
from app.planner.strategies.gemini import GeminiPlanner
from app.planner.strategies.local import LocalPlanner
from app.planner.strategies.openai import OpenAIPlanner
from app.planner.strategies.rule_based import RuleBasedPlanner
from app.schemas import Provider


# Registry of available planners
PLANNER_REGISTRY: Dict[Provider, Type[BasePlanner]] = {
    "rule_based": RuleBasedPlanner,
    "anthropic": AnthropicPlanner,
    "openai": OpenAIPlanner,
    "gemini": GeminiPlanner,
    "local": LocalPlanner,
}


class PlannerFactory:
    """
    Factory for creating planner instances.

    Caches planner instances to avoid repeated initialization.
    """

    def __init__(self):
        """Initialize the factory with an empty cache."""
        self._cache: Dict[Provider, BasePlanner] = {}

    def get_planner(self, provider: Provider) -> BasePlanner:
        """
        Get or create a planner for the given provider.

        Args:
            provider: The provider name.

        Returns:
            A BasePlanner instance for the provider.

        Raises:
            ValueError: If the provider is not supported.
        """
        # Return cached instance if available
        if provider in self._cache:
            return self._cache[provider]

        # Get planner class from registry
        planner_class = PLANNER_REGISTRY.get(provider)
        if not planner_class:
            raise ValueError(f"Unknown provider: {provider}")

        # Create and cache instance
        planner = planner_class()
        self._cache[provider] = planner

        return planner

    def clear_cache(self):
        """Clear the planner cache."""
        self._cache.clear()


# Global factory instance
_factory: Optional[PlannerFactory] = None


def get_factory() -> PlannerFactory:
    """Get the global planner factory instance."""
    global _factory
    if _factory is None:
        _factory = PlannerFactory()
    return _factory


def create_planner(provider: Optional[Provider] = None) -> BasePlanner:
    """
    Create a planner for the given provider.

    If provider is None, uses the default from settings.

    Args:
        provider: The provider name, or None for default.

    Returns:
        A BasePlanner instance.
    """
    if provider is None:
        provider = get_settings().default_provider

    return get_factory().get_planner(provider)
