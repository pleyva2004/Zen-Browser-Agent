"""
Response schemas for the planning API.

These models define the structure of responses from the /plan endpoint.
"""

from pydantic import BaseModel
from typing import Literal, Optional, List


# Available tool operations
Tool = Literal["CLICK", "TYPE", "SCROLL", "NAVIGATE"]


class Step(BaseModel):
    """
    A single step in an execution plan.

    Represents one action the browser extension should perform.
    The tool field determines which operation to execute, and the
    other fields provide parameters for that operation.

    Attributes:
        tool: The operation to perform (CLICK, TYPE, SCROLL, NAVIGATE).
        selector: CSS selector for the target element (CLICK, TYPE).
        text: Text to type (TYPE only).
        deltaY: Scroll amount in pixels (SCROLL only).
        url: URL to navigate to (NAVIGATE only).
        note: Human-readable explanation of this step.

    Examples:
        Click: {"tool": "CLICK", "selector": "#submit-btn", "note": "Submit form"}
        Type:  {"tool": "TYPE", "selector": "input[name=q]", "text": "hello", "note": "Type query"}
        Scroll: {"tool": "SCROLL", "deltaY": 500, "note": "Scroll down"}
        Navigate: {"tool": "NAVIGATE", "url": "https://example.com", "note": "Go to page"}
    """

    tool: Tool
    """The operation to perform: CLICK, TYPE, SCROLL, or NAVIGATE."""

    selector: Optional[str] = None
    """CSS selector for the target element. Required for CLICK and TYPE."""

    text: Optional[str] = None
    """Text to type into the element. Required for TYPE."""

    deltaY: Optional[int] = None
    """Scroll amount in pixels. Positive = down, negative = up. Used for SCROLL."""

    url: Optional[str] = None
    """URL to navigate to. Required for NAVIGATE."""

    note: Optional[str] = None
    """Human-readable explanation of what this step does."""


class PlanResponse(BaseModel):
    """
    Response containing an execution plan.

    Returned by the /plan endpoint with a summary of the plan
    and a list of steps to execute.

    Attributes:
        summary: Human-readable summary of the plan.
        steps: Ordered list of steps to execute.
        error: Error message if planning failed.

    Example:
        {
            "summary": "Searching for 'machine learning'",
            "steps": [
                {"tool": "CLICK", "selector": "input[name=q]", "note": "Focus search"},
                {"tool": "TYPE", "selector": "input[name=q]", "text": "machine learning"},
                {"tool": "CLICK", "selector": "button[type=submit]", "note": "Submit"}
            ]
        }
    """

    summary: str
    """Human-readable summary of what the plan will do."""

    steps: List[Step]
    """Ordered list of steps to execute."""

    error: Optional[str] = None
    """Error message if planning failed. Steps will be empty if error is set."""
