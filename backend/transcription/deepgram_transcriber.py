"""
Chunked transcription via the Go transcriber binary (cmd/transcriber), which
splits the video into chunks, transcribes each chunk concurrently against
the Deepgram API, and returns merged transcript segments.
"""
import json
import logging
import os
import subprocess

from pipeline.chunk_splitter import compute_chunks, find_silence_points, get_video_duration

log = logging.getLogger(__name__)

TRANSCRIBER_BIN = os.getenv(
    "TRANSCRIBER_BIN",
    os.path.join(os.path.dirname(__file__), "..", "bin", "transcriber"),
)

CHUNK_SIZE = int(os.getenv("TRANSCRIBER_CHUNK_SIZE", "60"))
CHUNK_OVERLAP = int(os.getenv("TRANSCRIBER_CHUNK_OVERLAP", "5"))


def transcribe_audio_chunked(video_path: str, duration: float | None = None) -> tuple[list[dict], str]:
    """
    Split video_path into chunks, transcribe each chunk concurrently via the
    Go + Deepgram transcriber, and return merged transcript segments.

    Each segment looks like:
        {"start": 120.5, "end": 124.2, "text": "what a goal"}
    """
    if duration is None:
        duration = get_video_duration(video_path)

    silences = find_silence_points(video_path)
    chunks = compute_chunks(duration, CHUNK_SIZE, CHUNK_OVERLAP, silences)

    payload = json.dumps({"video_path": video_path, "chunks": chunks})

    log.info("Transcribing %s via Go/Deepgram transcriber (%d chunks)", video_path, len(chunks))

    result = subprocess.run(
        [TRANSCRIBER_BIN],
        input=payload,
        capture_output=True,
        text=True,
        check=True,
    )

    for line in result.stderr.splitlines():
        log.warning("[transcriber] %s", line)

    segments = json.loads(result.stdout)
    return segments, "en"


def save_transcript(segments: list[dict], output_path: str) -> None:
    """Save transcript segments to JSON."""
    with open(output_path, "w", encoding="utf-8") as file_handle:
        json.dump(segments, file_handle, indent=2)
    log.info("Transcript saved to: %s", output_path)
