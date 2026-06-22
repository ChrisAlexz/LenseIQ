"""Tests for pipeline/chunk_splitter.py — pure logic, no ffmpeg/ffprobe calls."""
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from pipeline.chunk_splitter import compute_chunks, snap_to_silence, compute_tiered_chunks


def test_snap_to_silence_finds_nearest_midpoint_within_tolerance():
    silences = [(10.0, 10.6)]  # midpoint = 10.3
    result = snap_to_silence(target_time=10.5, silences=silences, tolerance=3.0)
    assert result == 10.3


def test_snap_to_silence_returns_target_when_no_silence_within_tolerance():
    silences = [(100.0, 100.6)]  # midpoint = 100.3, far from target
    result = snap_to_silence(target_time=10.0, silences=silences, tolerance=3.0)
    assert result == 10.0


def test_snap_to_silence_returns_target_with_no_silences():
    result = snap_to_silence(target_time=42.0, silences=[], tolerance=3.0)
    assert result == 42.0


def test_compute_chunks_covers_full_duration_with_no_silences():
    duration = 130.0
    chunks = compute_chunks(duration, chunk_size=60, overlap=5, silences=[])

    # Hard boundaries should be contiguous and cover [0, duration]
    assert chunks[0]["hard_start"] == 0.0
    assert chunks[-1]["hard_end"] == duration
    for i in range(len(chunks) - 1):
        assert chunks[i]["hard_end"] == chunks[i + 1]["hard_start"]


def test_compute_chunks_overlap_extends_start_and_end():
    duration = 130.0
    chunks = compute_chunks(duration, chunk_size=60, overlap=5, silences=[])

    first = chunks[0]
    # start is extended backward by overlap, clamped at 0
    assert first["start"] == max(0.0, first["hard_start"] - 5)
    # end is extended forward by overlap, clamped at duration
    assert first["end"] == min(duration, first["hard_end"] + 5)


def test_compute_chunks_snaps_hard_boundary_to_nearby_silence():
    duration = 120.0
    # Silence right near the natural 60s cut point
    silences = [(58.0, 59.0)]  # midpoint 58.5, within 3s tolerance of 60
    chunks = compute_chunks(duration, chunk_size=60, overlap=5, silences=silences)

    assert chunks[0]["hard_end"] == 58.5


def test_compute_chunks_short_video_single_chunk():
    chunks = compute_chunks(duration=10.0, chunk_size=60, overlap=5, silences=[])
    assert len(chunks) == 1
    assert chunks[0]["hard_start"] == 0.0
    assert chunks[0]["hard_end"] == 10.0


def test_compute_tiered_chunks_evenly_spaced():
    chunks = compute_tiered_chunks(duration=100.0, num_chunks=4, overlap=0)
    assert len(chunks) == 4
    assert chunks[0]["hard_start"] == 0.0
    assert chunks[-1]["hard_end"] == 100.0
    for c in chunks:
        assert c["hard_end"] - c["hard_start"] == 25.0


def test_compute_tiered_chunks_rejects_invalid_num_chunks():
    import pytest
    with pytest.raises(ValueError):
        compute_tiered_chunks(duration=100.0, num_chunks=0)
