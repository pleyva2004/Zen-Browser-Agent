"""
Matcher function tests.
"""

import pytest

from app.planner.matcher import best_match, find_search_input
from app.schemas import Candidate


def test_best_match_finds_input():
    """Test that best_match finds matching input."""
    candidates = [
        Candidate(
            selector="input[name='q']",
            tag="input",
            placeholder="Search",
            text="",
            ariaLabel="",
            name="q",
            type="text",
            href="",
        ),
    ]

    result = best_match(candidates, {"input"}, ["search"])

    assert result is not None
    assert result.selector == "input[name='q']"


def test_best_match_returns_none_when_no_match():
    """Test that best_match returns None when no match."""
    candidates = [
        Candidate(
            selector="button",
            tag="button",
            text="Submit",
            ariaLabel="",
            placeholder="",
            name="",
            type="",
            href="",
        ),
    ]

    result = best_match(candidates, {"input"}, ["search"])

    assert result is None


def test_find_search_input():
    """Test find_search_input convenience function."""
    candidates = [
        Candidate(
            selector="input[name='q']",
            tag="input",
            placeholder="Search Google",
            text="",
            ariaLabel="",
            name="q",
            type="text",
            href="",
        ),
    ]

    result = find_search_input(candidates)

    assert result is not None
    assert result.selector == "input[name='q']"