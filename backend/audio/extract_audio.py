#extracts audio from video using ffmpeg (terminal command)
#creates a folder called "extracted" to store all audio files for each video ingested - Binoy Saha

import subprocess
import os

def extract_audio(video_path, output_dir="backend/audio/extracted"):
    os.makedirs(output_dir, exist_ok=True)
    base = os.path.splitext(os.path.basename(video_path))[0]
    output_path = os.path.join(output_dir, f"{base}_audio.wav")
    command = ['ffmpeg', '-i', video_path, '-ac', '1', '-ar', '16000', '-y', output_path]
    subprocess.run(command, check=True)
    return output_path

def extract_audio_chunk(video_path: str, start: float, end: float, output_path: str) -> str:
    """
    Extract [start, end) seconds from video_path into output_path as 16kHz mono WAV.
    Uses fast keyframe seek (-ss before -i) so cost is O(chunk_size), not O(video_length).
    """
    duration = end - start
    command = [
        "ffmpeg",
        "-ss", str(start),   # placed BEFORE -i → fast index-based seek
        "-i", video_path,
        "-t", str(duration),
        "-ac", "1",
        "-ar", "16000",
        "-vn",               # drop video stream entirely
        "-y", output_path
    ]
    subprocess.run(command, check=True, capture_output=True)
    return output_path
