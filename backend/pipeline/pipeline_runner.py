import json
import os
import subprocess
import sys
import time
import uuid

import soundfile as sf

from acoustic.spike_detection import detect_spikes_from_waveform
from audio.extract_audio import extract_audio
from caption.burn_captions import burn_captions
from caption.generate_caption import generate_captions
from llm.highlight_selector import select_highlights_with_llm
from linguistic.keyword_detection import fuse_with_spikes, load_keyword_config, merge_events, score_segments
from transcription.deepgram_transcriber import save_transcript, transcribe_audio_chunked
from video.clip_generator import generate_clips

STAGES = [
    ("ingestion", "Watching your footage"),
    ("processing_audio", "Scouting the highlights"),
    ("generating_captions", "Picking the best moments"),
    ("generating_clips", "Building your reels"),
    ("burning_captions", "Burning captions"),
]

TOTAL_STEPS = len(STAGES)


def _make_emitter(progress_callback, pipeline_start):
    def emit(stage_index, status, detail=""):
        if progress_callback is None:
            return

        stage_key, stage_label = STAGES[stage_index]
        event = {
            "stage": stage_key,
            "label": stage_label,
            "step": stage_index + 1,
            "total": TOTAL_STEPS,
            "elapsed": round(time.time() - pipeline_start, 1),
            "status": status,
            "detail": detail,
        }
        progress_callback(event)
        print(
            f"[Pipeline] [{event['step']}/{TOTAL_STEPS}] {stage_label} - "
            f"{status} ({event['elapsed']}s elapsed)"
            + (f" {detail}" if detail else "")
        )

    return emit


def _resolve_ffmpeg_workers(explicit: int | None = None) -> int:
    if explicit is not None:
        return max(1, int(explicit))
    env = os.getenv("AUTOREEL_FFMPEG_WORKERS")
    if env and env.isdigit():
        return max(1, int(env))
    cpu = os.cpu_count() or 4
    return max(1, cpu - 1)


def parallel_pipeline_runner(
    video_file: str,
    sport: str = "soccer",
    plan: str = "free",
    # Backwards-compatible args (previously used for chunk-based parallelism)
    chunk_size: int = 60,
    overlap: int = 5,
    max_workers: int = 4,
    output_base_dir: str | None = None,
    caption_enabled: bool = True,
    caption_style: str = "bold_impact",
    caption_position: str = "middle",
    aspect_ratio: str = "9:16",
    progress_callback=None,
    ffmpeg_workers: int | None = None,
    topic: str = "",
    caption_color: str = "#ffffff",
    no_watermark: bool = False,
) -> dict:
    """
    Production runner used by the API server.

    Parallelism strategy:
      - Keep dependency chain sequential (audio -> transcript/spikes -> highlights -> clips -> caption burn)
      - Use all CPU cores for *per-clip FFmpeg work* (clip generation + caption burn) via bounded parallelism
      - Avoid per-chunk FFmpeg audio extraction: extract audio once for the full video, then operate in memory
    """
    pipeline_start = time.time()
    emit = _make_emitter(progress_callback, pipeline_start)

    base = os.path.splitext(os.path.basename(video_file))[0]
    job_id = str(uuid.uuid4())
    root = output_base_dir or os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "outputs")
    output_dir = os.path.join(root, f"{base}_{job_id[:8]}")

    transcript_path = os.path.join(output_dir, "transcript.json")
    spikes_path = os.path.join(output_dir, "spikes.json")
    highlights_path = os.path.join(output_dir, "highlight_candidates.json")
    captions_path = os.path.join(output_dir, "captions.json")
    clips_dir = os.path.join(output_dir, "clips")
    captioned_dir = os.path.join(output_dir, "captioned")

    os.makedirs(output_dir, exist_ok=True)
    os.makedirs(clips_dir, exist_ok=True)
    os.makedirs(captioned_dir, exist_ok=True)

    print(f"\n{'=' * 60}")
    print(f"[Pipeline] Starting - job_id={job_id}")
    print(f"[Pipeline] Video: {video_file} Sport: {sport} Plan: {plan}")
    print(f"{'=' * 60}\n")

    # Keep signature stable: if callers pass max_workers, treat it as ffmpeg_workers.
    # (chunk_size/overlap are no longer used because we avoid per-chunk ffmpeg extraction.)
    if ffmpeg_workers is None and max_workers is not None:
        ffmpeg_workers = int(max_workers)
    ffmpeg_workers = _resolve_ffmpeg_workers(ffmpeg_workers)

    try:
        emit(0, "running")
        try:
            probe = subprocess.run(
                ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "json", video_file],
                capture_output=True,
                text=True,
                check=True,
            )
            duration = float(json.loads(probe.stdout)["format"]["duration"])
        except Exception as probe_err:
            print(f"[Pipeline] Warning: could not read duration ({probe_err})")
            duration = 0.0
        emit(0, "done", f"duration={duration:.1f}s")

        emit(1, "running", "extracting audio + transcribing + spikes")
        audio_file = extract_audio(video_file, output_dir=os.path.join(output_dir, "audio"))

        # Transcribe via concurrent chunked requests to Deepgram (Go transcriber).
        segments, detected_language = transcribe_audio_chunked(video_file, duration=duration)
        save_transcript(segments, transcript_path)

        # Load audio once and detect spikes in memory (no per-chunk disk reload).
        y, sr = sf.read(audio_file, dtype="float32", always_2d=False)
        if y is None:
            y = []
        if getattr(y, "ndim", 1) > 1:
            # Force mono
            y = y.mean(axis=1)
        spikes = detect_spikes_from_waveform(y=y, sr=int(sr or 16000))
        with open(spikes_path, "w", encoding="utf-8") as f:
            json.dump(spikes, f, indent=2)

        if plan == "pro":
            final = select_highlights_with_llm(segments=segments, video_duration=duration, topic=topic)
        else:
            # Linguistic scoring runs in-process. It's cheap relative to transcription/ffmpeg.
            keyword_config = load_keyword_config(sport, language=detected_language)
            scored = score_segments(segments, keyword_config)
            merged = merge_events(scored)
            final = fuse_with_spikes(merged, spikes_path)
            final.sort(key=lambda event: (-event["score"], event["start"]))
        with open(highlights_path, "w", encoding="utf-8") as f:
            json.dump(final, f, indent=2)

        emit(1, "done", f"segments={len(segments)} spikes={len(spikes)} candidates={len(final)}")

        emit(2, "running")
        clip_padding = 0 if plan == "pro" else 15
        generate_captions(transcript_path, highlights_path, captions_path, padding=clip_padding)
        emit(2, "done", f"saved -> {captions_path}")

        emit(3, "running", f"ffmpeg_workers={ffmpeg_workers}")
        clips = generate_clips(
            video_file,
            highlights_path,
            output_dir=clips_dir,
            padding=clip_padding,
            aspect_ratio=aspect_ratio,
            max_workers=ffmpeg_workers,
            ffmpeg_threads=None,
            no_watermark=no_watermark,
        )
        emit(3, "done", f"{len(clips)} clips generated")

        emit(4, "running", f"ffmpeg_workers={ffmpeg_workers}")
        if caption_enabled:
            burn_captions(
                captions_path,
                clips_dir=clips_dir,
                output_dir=captioned_dir,
                style_name=caption_style,
                position=caption_position,
                aspect_ratio=aspect_ratio,
                max_workers=ffmpeg_workers,
                ffmpeg_threads=None,
                caption_color=caption_color,
            )
            emit(4, "done", f"saved -> {captioned_dir}")
        else:
            emit(4, "done", "skipped because captions are disabled")

    except Exception as exc:
        if progress_callback:
            progress_callback(
                {
                    "stage": "error",
                    "label": "Pipeline failed",
                    "step": 0,
                    "total": TOTAL_STEPS,
                    "elapsed": round(time.time() - pipeline_start, 1),
                    "status": "error",
                    "detail": str(exc),
                }
            )
        raise

    total_elapsed = round(time.time() - pipeline_start, 1)
    print(f"\n[Pipeline] Complete in {total_elapsed}s")
    print(f"  - Transcript: {transcript_path}")
    print(f"  - Spikes:     {spikes_path}")
    print(f"  - Highlights: {highlights_path}")
    print(f"  - Captions:   {captions_path}")
    print(f"  - Clips:      {clips_dir}")
    print(f"  - Captioned:  {captioned_dir}")

    return {
        "job_id": job_id,
        "transcript": transcript_path,
        "spikes": spikes_path,
        "highlights": highlights_path,
        "captions": captions_path,
        "clips": clips_dir,
        "captioned": captioned_dir,
        "elapsed": total_elapsed,
        "caption_enabled": caption_enabled,
        "aspect_ratio": aspect_ratio,
        "plan": plan,
        "video_duration_seconds": duration,
    }


def pipeline_runner(video_file, sport="soccer"):
    # Legacy CLI runner kept for local debugging.
    return parallel_pipeline_runner(video_file=video_file, sport=sport, progress_callback=None)


if __name__ == "__main__":
    if len(sys.argv) < 2:
        video_path = ".../assets/main.mp4"
        print("No video provided. Using default:", video_path)
    else:
        video_path = sys.argv[1]

    if not os.path.exists(video_path):
        print(f"Error: File not found: {video_path}")
        sys.exit(1)

    sport = sys.argv[2] if len(sys.argv) > 2 else "soccer"
    parallel_pipeline_runner(video_path, sport=sport)
