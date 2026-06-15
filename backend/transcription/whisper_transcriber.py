"""
This module transcribes audio with faster-whisper and returns normalized segments.
"""
import json
import logging
import os
import time

from faster_whisper import WhisperModel

from linguistic.keyword_detection import run_linguistic

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
)

log = logging.getLogger(__name__)

WHISPER_MODEL_SIZE = os.getenv("WHISPER_MODEL_SIZE", "small")
WHISPER_DEVICE = os.getenv("WHISPER_DEVICE", "cpu")
WHISPER_COMPUTE_TYPE = os.getenv("WHISPER_COMPUTE_TYPE", "int8")
WHISPER_CPU_THREADS = os.getenv("WHISPER_CPU_THREADS", "")
WHISPER_NUM_WORKERS = os.getenv("WHISPER_NUM_WORKERS", "")

_model_cache: dict = {}


def load_whisper_model(
    model_size: str = WHISPER_MODEL_SIZE,
    device: str = WHISPER_DEVICE,
    compute_type: str = WHISPER_COMPUTE_TYPE,
):
    """Load once, cache forever."""
    cache_key = (model_size, device, compute_type)
    if cache_key not in _model_cache:
        log.info(
            "Loading faster-whisper model size=%s device=%s compute_type=%s",
            model_size,
            device,
            compute_type,
        )
        cpu_threads = None
        num_workers = None
        if WHISPER_CPU_THREADS.isdigit():
            cpu_threads = int(WHISPER_CPU_THREADS)
        if WHISPER_NUM_WORKERS.isdigit():
            num_workers = int(WHISPER_NUM_WORKERS)

        # Sensible defaults for CPU: use most cores for compute, a few workers for I/O/pipeline.
        if device == "cpu":
            cpu = os.cpu_count() or 4
            if cpu_threads is None:
                cpu_threads = max(1, cpu - 1)
            if num_workers is None:
                num_workers = min(4, cpu_threads)

        _model_cache[cache_key] = WhisperModel(
            model_size,
            device=device,
            compute_type=compute_type,
            cpu_threads=cpu_threads,
            num_workers=num_workers,
        )
    return _model_cache[cache_key]


def transcribe_audio(audio_source, model=None, language=None) -> tuple[list[dict], str]:
    """
    Transcribe an audio file and return normalized transcript segments.

    Each segment looks like:
        [{"start": 120.5, "end": 124.2, "text": "what a goal"}, language"]
    """
    if model is None:
        model = load_whisper_model()

    log.info("Transcribing: %s", audio_source)
    start_time = time.time()

    segments_iter, info = model.transcribe(
        audio_source,
        language=language,
        condition_on_previous_text=True,
        vad_filter=False,
        beam_size=5,
    )

    detected_language = info.language

    segments = []
    for seg in segments_iter:
        text = (seg.text or "").strip()
        if not text:
            continue
        segments.append(
            {
                "start": round(float(seg.start), 3),
                "end": round(float(seg.end), 3),
                "text": text,
            }
        )

    elapsed = time.time() - start_time
    log.info(
        "Transcription done in %.1f seconds. Found %s segments.",
        elapsed,
        len(segments),
        detected_language,
    )
    return segments, detected_language


def save_transcript(segments: list[dict], output_path: str) -> None:
    """Save transcript segments to JSON."""
    with open(output_path, "w", encoding="utf-8") as file_handle:
        json.dump(segments, file_handle, indent=2)
    log.info("Transcript saved to: %s", output_path)


if __name__ == "__main__":
    transcript_file = "../transcription/transcript.json"
    spikes_path = "../acoustic/spikes.json"
    output_file = "../outputs/test_highlights.json"

    run_linguistic(
        transcript_file=transcript_file,
        output_file=output_file,
        sport="soccer",
        spikes_path=spikes_path,
    )
