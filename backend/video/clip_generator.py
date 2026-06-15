import json
import os
import subprocess
import concurrent.futures

from video.watermark import get_watermark_path


ASPECT_RATIO_DIMENSIONS = {
    "9:16": (1080, 1920),
    "16:9": (1920, 1080),
}

# Clip generation defaults optimized for speed. Override with env vars if needed.
X264_PRESET = os.getenv("AUTOREEL_X264_PRESET", "ultrafast")
X264_CRF = os.getenv("AUTOREEL_X264_CRF", "28")  # higher = faster, lower bitrate
FFMPEG_LOG = os.getenv("AUTOREEL_FFMPEG_LOG", "0")  # set to "1" to see ffmpeg output
COPY_AUDIO = os.getenv("AUTOREEL_COPY_AUDIO", "1")  # "1" = copy if possible


def get_reel_budget(video_duration_seconds: float) -> int:
    """
    Returns the maximum number of reels to generate based on video length.

    Limit:
      > 20 min -> raise (video too long)

    Tiers (tunable):
      < 5 min  -> 4 reels
      < 10 min -> 6 reels
      < 20 min -> 8 reels
    """
    minutes = video_duration_seconds / 60

    if minutes > 20:
        raise ValueError("video too long")

    if minutes < 5:
        return 4
    if minutes < 12:
        return 6
    if minutes < 20:
        return 8
    return 20


def deduplicate_highlights(highlights: list, overlap_threshold: float = 0.5) -> list:
    """Removes highlights that substantially overlap a higher-scored highlight."""
    sorted_highlights = sorted(highlights, key=lambda event: -event["score"])
    accepted = []

    for candidate in sorted_highlights:
        c_start = candidate["start"]
        c_end = candidate["end"]
        c_len = c_end - c_start

        is_duplicate = False
        for kept in accepted:
            k_start = kept["start"]
            k_end = kept["end"]

            inter_start = max(c_start, k_start)
            inter_end = min(c_end, k_end)
            intersection = max(0.0, inter_end - inter_start)
            if intersection == 0:
                continue

            union = c_len + (k_end - k_start) - intersection
            iou = intersection / union if union > 0 else 0.0
            if iou >= overlap_threshold:
                is_duplicate = True
                break

        if not is_duplicate:
            accepted.append(candidate)

    return accepted


def expand_clip_window(event, padding=15, video_duration=None):
    """Add padding seconds before and after the detected event window."""
    start = max(event["start"] - padding, 0)
    end = event["end"] + padding

    if video_duration:
        end = min(end, video_duration)

    return start, end


def _watermark_width(aspect_ratio: str) -> int:
    """Scale watermark to ~22% of video width."""
    width, _ = ASPECT_RATIO_DIMENSIONS.get(aspect_ratio, ASPECT_RATIO_DIMENSIONS["9:16"])
    return round(width * 0.22)


def extract_clip(video_path, start, end, output_path, aspect_ratio="9:16", ffmpeg_threads: int | None = None, no_watermark=False):
    duration = end - start
    width, height = ASPECT_RATIO_DIMENSIONS.get(aspect_ratio, ASPECT_RATIO_DIMENSIONS["9:16"])

    if no_watermark:
        filter_complex = (
            f"scale={width}:{height}:force_original_aspect_ratio=increase,"
            f"crop={width}:{height}"
        )
        command = [
            "ffmpeg", "-y", "-ss", str(start), "-i", video_path,
            "-t", str(duration),
            "-vf", filter_complex,
            "-map", "0:v", "-map", "0:a?",
            "-c:v", "libx264", "-preset", X264_PRESET, "-crf", X264_CRF,
            "-c:a", "copy" if COPY_AUDIO == "1" else "aac",
            output_path,
        ]
    else:
        wm_path = get_watermark_path().replace("\\", "/")
        wm_size = _watermark_width(aspect_ratio)
        filter_complex = (
            f"[0:v]scale={width}:{height}:force_original_aspect_ratio=increase,"
            f"crop={width}:{height}[base];"
            f"[1:v]scale={wm_size}:-1[wm];"
            f"[base][wm]overlay=W-w-30:H-h-30[out]"
        )
        command = [
            "ffmpeg", "-y", "-ss", str(start), "-i", video_path, "-i", wm_path,
            "-t", str(duration),
            "-filter_complex", filter_complex,
            "-map", "[out]", "-map", "0:a?",
            "-c:v", "libx264", "-preset", X264_PRESET, "-crf", X264_CRF,
            "-c:a", "copy" if COPY_AUDIO == "1" else "aac",
            output_path,
        ]
    # Only set -threads when we explicitly want to cap/shape utilization.
    # IMPORTANT: Must be "-threads <n>" (order matters).
    if ffmpeg_threads is not None:
        n = max(1, int(ffmpeg_threads))
        try:
            idx = command.index("libx264") + 1
        except ValueError:
            idx = command.index("-preset")
        command[idx:idx] = ["-threads", str(n)]

    if FFMPEG_LOG == "1":
        subprocess.run(command, check=True)
    else:
        subprocess.run(command, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    return output_path


def generate_clips(
    video_path,
    highlights_file,
    output_dir="outputs/clips",
    padding=15,
    aspect_ratio="9:16",
    max_workers: int | None = None,
    ffmpeg_threads: int | None = None,
    no_watermark: bool = False,
):
    """Generate reels for the top deduplicated highlights in highlights_file."""
    os.makedirs(output_dir, exist_ok=True)

    with open(highlights_file, "r", encoding="utf-8") as file_handle:
        highlights = json.load(file_handle)

    if not highlights:
        print("[Clips] No highlights found, skipping clip generation.")
        return []

    video_duration = None
    try:
        probe = subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "json", video_path],
            capture_output=True,
            text=True,
            check=True,
        )
        video_duration = float(json.loads(probe.stdout)["format"]["duration"])
    except Exception as exc:
        print(f"[Clips] Warning: could not read video duration ({exc}), budget capped at 20.")

    unique_highlights = deduplicate_highlights(highlights)
    dropped = len(highlights) - len(unique_highlights)
    if dropped:
        print(f"[Clips] Deduplication removed {dropped} overlapping highlight(s).")

    budget = get_reel_budget(video_duration or 0)
    selected = unique_highlights[:budget]
    print(f"[Clips] {len(unique_highlights)} unique highlights -> keeping top {len(selected)} (budget={budget})")

    exact_windows = padding <= 0
    planned = []
    for i, event in enumerate(selected):
        if exact_windows:
            clip_start = max(0.0, float(event["start"]))
            clip_end = min(video_duration, float(event["end"])) if video_duration else float(event["end"])
        else:
            clip_start, clip_end = expand_clip_window(event, padding=padding, video_duration=video_duration)
        clip_path = os.path.join(output_dir, f"clip_{i}.mp4")
        planned.append((i, event, clip_start, clip_end, clip_path))

    if max_workers is None:
        cpu = os.cpu_count() or 4
        env_workers = os.getenv("AUTOREEL_FFMPEG_WORKERS")
        if env_workers and env_workers.isdigit():
            max_workers = max(1, int(env_workers))
        else:
            # Use available cores with one ffmpeg job per core (minus one for the OS),
            # but never exceed the number of clips.
            max_workers = max(1, min(cpu - 1, len(planned)))

    # Clamp for safety if caller passes too many.
    max_workers = max(1, min(int(max_workers), len(planned))) if planned else 1

    clips_out = [None] * len(planned)

    # If caller didn't choose, spread CPU across processes and threads to avoid low utilization
    # when the number of clips is small relative to core count.
    if ffmpeg_threads is None:
        cpu = os.cpu_count() or 4
        ffmpeg_threads = max(1, cpu // max(1, int(max_workers)))

    def _one(args):
        i, event, clip_start, clip_end, clip_path = args
        extract_clip(video_path, clip_start, clip_end, clip_path, aspect_ratio=aspect_ratio, ffmpeg_threads=ffmpeg_threads, no_watermark=no_watermark)
        return {
            "clip": clip_path,
            "start": clip_start,
            "end": clip_end,
            "score": event["score"],
            "index": i,
        }

    # FFmpeg is external, so threads are fine here (no GIL contention).
    with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as pool:
        futures = {pool.submit(_one, args): args[0] for args in planned}
        for fut in concurrent.futures.as_completed(futures):
            i = futures[fut]
            try:
                item = fut.result()
                clips_out[i] = item
                print(f"[Clips] [{i + 1}/{len(planned)}] {item['clip']}  score={item['score']}")
            except subprocess.CalledProcessError as exc:
                print(f"[Clips] Warning: failed to generate clip {i} -> {exc}")

    return [c for c in clips_out if c is not None]
