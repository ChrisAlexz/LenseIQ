"""
Generate per-clip caption word lists from the transcript + highlight windows.

Each caption entry is:
    {
      "highlight_id": int,
      "clip_start": float,   # absolute video time the clip starts
      "clip_end": float,     # absolute video time the clip ends
      "words": [{"word": str, "time": float}, ...]   # time is clip-relative
    }

`time` is the moment (in clip-relative seconds) the word is spoken. When the
transcript carries real per-word timestamps (from Deepgram), those are used
directly; otherwise we fall back to spreading a segment's words evenly across
its duration.
"""
import json
import os

PADDING = 15


def load_json(file_path):
    with open(file_path, "r") as f:
        return json.load(f)


def _segment_overlaps(seg, start_time, end_time):
    return seg["end"] >= start_time and seg["start"] <= end_time


def _even_words(seg):
    """Fallback: fake per-word timing by spreading words across the segment."""
    text = (seg.get("text") or "").strip()
    word_list = text.split()
    if not word_list:
        return []

    start = seg["start"]
    end = seg["end"]
    duration = max(end - start, 0.01)
    step = duration / len(word_list)
    return [
        {"word": word, "start": start + i * step}
        for i, word in enumerate(word_list)
    ]


def _segment_words(seg):
    """
    Return [{word, start}] in absolute video time for a transcript segment,
    using real per-word timestamps when present.
    """
    words = seg.get("words")
    if words:
        out = []
        for w in words:
            text = str(w.get("word", "")).strip()
            if not text:
                continue
            out.append({"word": text, "start": float(w.get("start", seg["start"]))})
        if out:
            return out
    return _even_words(seg)


def extract_caption_words(transcript, clip_start, clip_end):
    """Collect words spoken within [clip_start, clip_end], clip-relative."""
    words = []
    for seg in transcript:
        if not _segment_overlaps(seg, clip_start, clip_end):
            continue
        for w in _segment_words(seg):
            abs_start = w["start"]
            if abs_start < clip_start or abs_start > clip_end:
                continue
            words.append({
                "word": w["word"],
                "time": round(max(abs_start - clip_start, 0.0), 2),
            })

    words.sort(key=lambda item: item["time"])
    return words


def generate_captions(transcript_file, highlights_file, output_file="captions.json", padding=PADDING):
    transcript = load_json(transcript_file)
    highlights = load_json(highlights_file)

    all_captions = []

    for i, event in enumerate(highlights):
        clip_start = max(event["start"] - padding, 0)
        clip_end = event["end"] + padding

        words = extract_caption_words(transcript, clip_start, clip_end)

        all_captions.append({
            "highlight_id": i,
            "clip_start": clip_start,
            "clip_end": clip_end,
            "words": words,
        })

    os.makedirs(os.path.dirname(output_file) or ".", exist_ok=True)

    with open(output_file, "w") as f:
        json.dump(all_captions, f, indent=2)

    print(f"[Captions] Captions saved → {output_file}")
