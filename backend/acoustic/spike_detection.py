import librosa
import numpy as np
import json
import sys


def detect_spikes_from_waveform(
    y,
    sr: int = 16000,
    frame_length: int = 2048,
    hop_length: int = 512,
    threshold_db=None,
    time_offset: float = 0.0,
):
    """
    In-memory spike detector. Returns spikes with times in seconds.

    This is the same logic as detect_spikes(), but avoids reloading audio from disk
    for callers that already have the waveform in memory.
    """
    rms = librosa.feature.rms(y=y, frame_length=frame_length, hop_length=hop_length)[0]
    db = librosa.amplitude_to_db(rms, ref=np.max)
    times = librosa.frames_to_time(np.arange(len(db)), sr=sr, hop_length=hop_length)

    if threshold_db is None:
        # Keep the current default behavior. (These are tunable.)
        threshold_db = -7.0

    spikes = []
    for t, d in zip(times, db):
        if d >= threshold_db:
            spikes.append({"time": round(float(t + time_offset), 2), "db": round(float(d), 2)})

    # merge spikes within 3 seconds of each other, keep the loudest
    merged = []
    for spike in spikes:
        if merged and spike["time"] - merged[-1]["time"] < 3.0:
            if spike["db"] > merged[-1]["db"]:
                merged[-1] = spike
        else:
            merged.append(spike)

    return merged


def detect_spikes(
    audio_path,
    output_path="spikes.json",
    frame_length=2048,
    hop_length=512,
    threshold_db=None,
    time_offset=0.0,
):
    y, sr = librosa.load(audio_path, sr=16000, mono=True)
    merged = detect_spikes_from_waveform(
        y=y,
        sr=sr,
        frame_length=frame_length,
        hop_length=hop_length,
        threshold_db=threshold_db,
        time_offset=time_offset,
    )

    with open(output_path, "w") as f:
        json.dump(merged, f, indent=2)

    print(f"Detected {len(merged)} spikes, saved to {output_path}")
    return merged


if __name__ == "__main__":
    audio_file = sys.argv[1] if len(sys.argv) > 1 else "audio.wav"
    detect_spikes(audio_file)
