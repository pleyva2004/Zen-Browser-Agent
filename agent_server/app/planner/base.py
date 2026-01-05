"""
Base planner interface.

Defines the abstract interface that all planner implementations must follow.
Uses the Strategy pattern to allow swapping between different planning backends.
"""

from abc import ABC, abstractmethod

from app.schemas import PlanRequest, PlanResponse


class BasePlanner(ABC):
    """
    Abstract base class for all planner implementations.

    All planners (rule-based, Anthropic, OpenAI, etc.) must inherit
    from this class and implement the plan() method.

    The plan() method is async to support non-blocking LLM API calls.

    Example implementation:
        class MyPlanner(BasePlanner):
            async def plan(self, request: PlanRequest) -> PlanResponse:
                # Generate plan
                return PlanResponse(summary="...", steps=[...])
    """

    @abstractmethod
    async def plan(self, request: PlanRequest) -> PlanResponse:
        """
        Generate an execution plan for the user's request.

        This method receives the user's goal and current page state,
        and returns a plan with steps to execute.

        Args:
            request: The plan request containing userRequest, page, etc.

        Returns:
            PlanResponse with summary and list of steps.

        Raises:
            Exception: If planning fails (will be caught by router).
        """
        ...

    def get_name(self) -> str:
        """
        Get the name of this planner.

        Returns:
            Human-readable name of the planner (e.g., "anthropic").
        """
        return self.__class__.__name__.replace("Planner", "").lower()