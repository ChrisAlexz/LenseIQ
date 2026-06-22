"""Tests for caption/generate_caption.py and caption/burn_captions.py phrase logic."""
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from caption.generate_caption import _even_words, _segment_words, extract_caption_words
from caption.burn_captions import _phrase_layout, seconds_to_ass_time, _hex_to_ass


def test_even_words_spreads_words_across_segment_duration():
    seg = {"start": 10.0, "end": 12.0, "text": "what a goal"}
    words = _even_words(seg)
    assert len(words) == 3
    assert words[0]["start"] == 10.0
    # Each word's start should be monotonically increasing
    assert words[0]["start"] < words[1]["start"] < words[2]["start"]


def test_even_words_handles_empty_text():
    seg = {"start": 10.0, "end": 12.0, "text": ""}
    assert _even_words(seg) == []


def test_segment_words_prefers_real_deepgram_timestamps():
    seg = {
        "start": 10.0,
        "end": 12.0,
        "text": "what a goal",
        "words": [
            {"word": "what", "start": 10.0},
            {"word": "a", "start": 10.3},
            {"word": "goal", "start": 10.6},
        ],
    }
    words = _segment_words(seg)
    assert [w["word"] for w in words] == ["what", "a", "goal"]
    assert words[2]["start"] == 10.6


def test_segment_words_falls_back_to_even_spread_without_word_timestamps():
    seg = {"start": 10.0, "end": 12.0, "text": "what a goal", "words": []}
    words = _segment_words(seg)
    assert len(words) == 3


def test_extract_caption_words_filters_to_clip_window_and_is_clip_relative():
    transcript = [
        {"start": 0.0, "end": 5.0, "text": "before the clip", "words": [
            {"word": "before", "start": 1.0},
        ]},
        {"start": 10.0, "end": 14.0, "text": "what a goal", "words": [
            {"word": "what", "start": 10.0},
            {"word": "a", "start": 10.5},
            {"word": "goal", "start": 11.0},
        ]},
    ]
    words = extract_caption_words(transcript, clip_start=10.0, clip_end=14.0)
    assert [w["word"] for w in words] == ["what", "a", "goal"]
    # time is clip-relative: absolute 10.0 -> 0.0 within the clip
    assert words[0]["time"] == 0.0
    assert words[2]["time"] == 1.0


def test_phrase_layout_splits_on_long_gaps():
    words = [
        {"word": "what", "time": 0.0},
        {"word": "a", "time": 0.2},
        {"word": "goal", "time": 0.4},
        {"word": "incredible", "time": 5.0},  # big gap -> new phrase
    ]
    phrases = _phrase_layout(words)
    assert len(phrases) == 2
    assert [w["word"] for w in phrases[0]] == ["what", "a", "goal"]
    assert [w["word"] for w in phrases[1]] == ["incredible"]


def test_phrase_layout_caps_phrase_at_max_words():
    words = [{"word": f"w{i}", "time": i * 0.1} for i in range(5)]
    phrases = _phrase_layout(words)
    # MAX_PHRASE_WORDS is 3, so 5 close-together words split into multiple phrases
    assert all(len(p) <= 3 for p in phrases)


def test_seconds_to_ass_time_formats_correctly():
    assert seconds_to_ass_time(0) == "0:00:00.00"
    assert seconds_to_ass_time(65.25) == "0:01:05.25"
    assert seconds_to_ass_time(3661.5) == "1:01:01.50"


def test_hex_to_ass_converts_rgb_order_to_bgr():
    # ASS color format is &H00BBGGRR — red and blue should swap positions
    assert _hex_to_ass("#ff0000") == "&H000000FF"
    assert _hex_to_ass("#00ff00") == "&H0000FF00"
