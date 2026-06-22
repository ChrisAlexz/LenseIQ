"""Tests for linguistic/keyword_detection.py — pure scoring logic + config loading."""
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from linguistic.keyword_detection import (
    _is_summary,
    _excitement_multiplier,
    load_keyword_config,
    score_segments,
    merge_events,
)


def test_is_summary_detects_recap_language():
    assert _is_summary("That's the final score, 3 to 1.") is True
    assert _is_summary("Full-time here at the stadium.") is True


def test_is_summary_false_for_live_commentary():
    assert _is_summary("He shoots, and it's a GOAL!") is False


def test_excitement_multiplier_boosts_live_reaction():
    boosted = _excitement_multiplier("UNBELIEVABLE! What a goal!")
    neutral = _excitement_multiplier("The team walked onto the pitch.")
    assert boosted > neutral
    assert neutral == 1.0


def test_load_keyword_config_soccer_exists_and_has_expected_shape():
    config = load_keyword_config(sport="soccer", language="en")
    assert isinstance(config, dict)
    assert len(config) > 0


def test_load_keyword_config_raises_for_unknown_sport():
    import pytest
    with pytest.raises(FileNotFoundError):
        load_keyword_config(sport="curling", language="en")


def test_load_keyword_config_falls_back_to_english_for_missing_language():
    # "soccer" has an _es_ config, but a nonsense language code should fall
    # back to the English config rather than raising.
    config = load_keyword_config(sport="soccer", language="xx")
    assert isinstance(config, dict)
    assert len(config) > 0


def test_score_segments_keeps_only_segments_with_keyword_matches():
    config = load_keyword_config(sport="soccer", language="en")
    segments = [
        {"start": 0.0, "end": 4.0, "text": "He shoots, GOAL! What a strike!"},
        {"start": 4.0, "end": 8.0, "text": "Let's review the lineup for today."},
    ]
    scored = score_segments(segments, config)

    # Only the segment containing keywords ("shoots", "goal") survives —
    # segments with zero raw keyword score are filtered out entirely.
    assert len(scored) == 1
    assert scored[0]["text"] == segments[0]["text"]
    assert scored[0]["score"] > 0


def test_merge_events_combines_nearby_events():
    events = [
        {"start": 0.0, "end": 2.0, "score": 5, "text": "goal"},
        {"start": 3.0, "end": 5.0, "score": 3, "text": "still goal reaction"},
        {"start": 60.0, "end": 62.0, "score": 4, "text": "unrelated later moment"},
    ]
    merged = merge_events(events, merge_threshold=5, max_clip_length=20)
    # First two are within merge_threshold of each other -> merged into one event
    assert len(merged) == 2
