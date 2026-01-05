"""
Candidate element matcher.

Provides functions to find the best matching DOM element
from a list of candidates based on keywords and tag filters.
"""

from typing import Optional, List, Set

from app.schemas import Candidate


def best_match(
    candidates: List[Candidate],
    include_tags: Set[str],
    keywords: List[str],
) -> Optional[Candidate]:
    """
    Find the best matching candidate element.

    Scores each candidate based on:
    - Keyword matches in text, ariaLabel, placeholder, name, href (+2 each)
    - Presence of ariaLabel (+1)
    - Presence of placeholder (+1)
    - Presence of text (+1)

    Args:
        candidates: List of candidate elements to search.
        include_tags: Set of allowed tag names (e.g., {"input", "button"}).
        keywords: List of keywords to match against.

    Returns:
        The best matching candidate, or None if no match found.

    Example:
        >>> candidates = [Candidate(selector="#search", tag="input", placeholder="Search")]
        >>> best_match(candidates, {"input"}, ["search"])
        Candidate(selector="#search", ...)
    """
    # Normalize keywords to lowercase, filter empty
    keywords_lower = [k.lower().strip() for k in keywords if k and k.strip()]

    if not keywords_lower:
        return None

    best: Optional[Candidate] = None
    best_score = -1

    for candidate in candidates:
        # Filter by tag
        if candidate.tag.lower() not in include_tags:
            continue

        # Build searchable text from all fields
        haystack = " ".join([
            candidate.text or "",
            candidate.ariaLabel or "",
            candidate.placeholder or "",
            candidate.name or "",
            candidate.href or "",
        ]).lower()

        # Calculate score
        score = 0

        # Keyword matches (+2 each)
        for keyword in keywords_lower:
            if keyword in haystack:
                score += 2

        # Bonus for well-labeled elements
        if candidate.ariaLabel:
            score += 1
        if candidate.placeholder:
            score += 1
        if candidate.text:
            score += 1

        # Update best if this is higher
        if score > best_score:
            best_score = score
            best = candidate

    return best


def find_search_input(candidates: List[Candidate]) -> Optional[Candidate]:
    """
    Find a search input element.

    Convenience function that looks for input/textarea elements
    with search-related attributes.

    Args:
        candidates: List of candidate elements to search.

    Returns:
        The best matching search input, or None if not found.
    """
    return best_match(
        candidates,
        include_tags={"input", "textarea"},
        keywords=["search", "q", "query", "find", "looking for"],
    )


def find_submit_button(candidates: List[Candidate]) -> Optional[Candidate]:
    """
    Find a submit/search button element.

    Args:
        candidates: List of candidate elements to search.

    Returns:
        The best matching submit button, or None if not found.
    """
    return best_match(
        candidates,
        include_tags={"button", "a", "input"},
        keywords=["search", "submit", "go", "find"],
    )


def find_clickable(candidates: List[Candidate], target: str) -> Optional[Candidate]:
    """
    Find a clickable element matching the target text.

    Args:
        candidates: List of candidate elements to search.
        target: Text to match against (e.g., "Sign in").

    Returns:
        The best matching clickable element, or None if not found.
    """
    return best_match(
        candidates,
        include_tags={"button", "a", "input"},
        keywords=[target],
    )
