# chunk_splitter.py
import subprocess
import json


def get_video_duration(video_path: str) -> float:
    result = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "json", video_path],
        capture_output=True, text=True, check=True
    )
    data = json.loads(result.stdout)
    return float(data["format"]["duration"])


def find_silence_points(video_path: str, min_silence_dur: float = 0.3, noise_floor: int = -35) -> list:
    """Returns list of (start, end) silence intervals in seconds."""
    result = subprocess.run([
        "ffmpeg", "-i", video_path,
        "-af", f"silencedetect=noise={noise_floor}dB:d={min_silence_dur}",
        "-f", "null", "-"
    ], capture_output=True, text=True)

    silences = []
    current_start = None
    for line in result.stderr.splitlines():
        if "silence_start" in line:
            try:
                current_start = float(line.split("silence_start: ")[1].split()[0])
            except (IndexError, ValueError):
                pass
        if "silence_end" in line and current_start is not None:
            try:
                end_val = float(line.split("silence_end: ")[1].split()[0])
                silences.append((current_start, end_val))
                current_start = None
            except (IndexError, ValueError):
                pass
    return silences


def snap_to_silence(target_time: float, silences: list, tolerance: float = 3.0) -> float:
    """Return the nearest silence midpoint within tolerance seconds of target, or target itself."""
    best, best_dist = target_time, float("inf")
    for s_start, s_end in silences:
        midpoint = (s_start + s_end) / 2
        dist = abs(midpoint - target_time)
        if dist < best_dist and dist <= tolerance:
            best_dist, best = dist, midpoint
    return best


def compute_chunks(duration: float, chunk_size: int = 60, overlap: int = 5, silences: list = None) -> list:
    """
    Returns a list of chunk dicts:
      { index, hard_start, hard_end, start (extended), end (extended) }

    hard_start / hard_end  — the non-overlapping region this chunk "owns"
    start / end            — extended with overlap for transcription context
    """
    if silences is None:
        silences = []

    chunks = []
    cursor = 0.0

    while cursor < duration:
        hard_start = cursor
        hard_end_target = min(cursor + chunk_size, duration)
        hard_end = snap_to_silence(hard_end_target, silences, tolerance=3.0)
        hard_end = min(hard_end, duration)

        # Guard against snap not advancing the cursor
        if hard_end <= cursor:
            hard_end = min(cursor + chunk_size, duration)

        chunks.append({
            "index":      len(chunks),
            "hard_start": round(hard_start, 3),
            "hard_end":   round(hard_end,   3),
            "start":      round(max(0.0,     hard_start - overlap), 3),
            "end":        round(min(duration, hard_end   + overlap), 3),
        })

        cursor = hard_end

    return chunks


def compute_tiered_chunks(duration: float, num_chunks: int, overlap: float = 5) -> list:
    """
    Deterministic tiered chunking:
      - hard boundaries are exactly evenly spaced (no silence snapping)
      - start/end extend with `overlap` for transcription context

    Returns list of:
      { index, hard_start, hard_end, start, end }
    """
    if num_chunks <= 0:
        raise ValueError("num_chunks must be >= 1")

    chunks: list[dict] = []
    step = float(duration) / float(num_chunks)

    for i in range(num_chunks):
        hard_start = float(i) * step
        hard_end = float(i + 1) * step if i + 1 < num_chunks else float(duration)

        # Clamp and guard for very short durations
        if hard_start >= duration:
            break
        hard_end = min(hard_end, duration)
        if hard_end <= hard_start:
            continue

        chunks.append(
            {
                "index": len(chunks),
                "hard_start": round(hard_start, 3),
                "hard_end": round(hard_end, 3),
                "start": round(max(0.0, hard_start - overlap), 3),
                "end": round(min(duration, hard_end + overlap), 3),
            }
        )

    return chunks
import os

def split_into_chunks(video_path: str, output_dir: str, chunk_size: int = 60, overlap: int = 5) -> list:
    os.makedirs(output_dir, exist_ok=True)
    
    duration = get_video_duration(video_path)
    silences = find_silence_points(video_path)
    chunks = compute_chunks(duration, chunk_size, overlap, silences)

    chunk_files = []
    for chunk in chunks:
        output_path = os.path.join(output_dir, f"chunk_{chunk['index']}.mp4")
        
        subprocess.run([
            "ffmpeg", "-y",
            "-i", video_path,
            "-ss", str(chunk["start"]),
            "-to", str(chunk["end"]),
            "-c", "copy",
            output_path
        ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

        chunk["file"] = output_path
        chunk_files.append(chunk)
        print(f"[Chunk {chunk['index']}] {chunk['start']}s → {chunk['end']}s → {output_path}")

    return chunk_files