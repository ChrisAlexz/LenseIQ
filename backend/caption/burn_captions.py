import json
import os
import subprocess
from concurrent.futures import ThreadPoolExecutor


ASPECT_RATIO_DIMENSIONS = {
    "9:16": (1080, 1920),
    "16:9": (1920, 1080),
}

STYLE_PRESETS = {
    "bold_impact": {
        "font": "Anton",
        "size": 90,
        "primary": "&H0000FFFF",
        "outline": "&H00000000",
        "back": "&H00000000",
        "bold": 1,
        "italic": 0,
        "outline_size": 4,
        "shadow": 2,
        "spacing": -2,
    },
    "clean_modern": {
        "font": "Arial",
        "size": 74,
        "primary": "&H00FFFFFF",
        "outline": "&H00000000",
        "back": "&H00000000",
        "bold": 1,
        "italic": 0,
        "outline_size": 3,
        "shadow": 1,
        "spacing": 0,
    },
    "classic_serif": {
        "font": "Georgia",
        "size": 78,
        "primary": "&H00F5F5F5",
        "outline": "&H00000000",
        "back": "&H00000000",
        "bold": 1,
        "italic": 0,
        "outline_size": 2,
        "shadow": 1,
        "spacing": 0,
    },
    "neon_pop": {
        "font": "Montserrat",
        "size": 80,
        "primary": "&H0000FF66",
        "outline": "&H00000000",
        "back": "&H00000000",
        "bold": 1,
        "italic": 0,
        "outline_size": 3,
        "shadow": 2,
        "spacing": 1,
    },
    "typewriter": {
        "font": "Courier New",
        "size": 72,
        "primary": "&H00FFFFFF",
        "outline": "&H00000000",
        "back": "&H00000000",
        "bold": 0,
        "italic": 0,
        "outline_size": 2,
        "shadow": 1,
        "spacing": 0,
    },
}

POSITION_TO_ALIGNMENT = {
    "top": 8,
    "middle": 5,
    "bottom": 2,
}


def seconds_to_ass_time(seconds):
    hrs = int(seconds // 3600)
    mins = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    centisecs = int((seconds - int(seconds)) * 100)
    return f"{hrs}:{mins:02}:{secs:02}.{centisecs:02}"


def _scale_style_for_resolution(style, position, width, height, font_scale=1.0):
    base_width = 1080
    base_height = 1920
    resolution_scale = min(width / base_width, height / base_height)
    font_scale = max(0.25, float(font_scale)) * resolution_scale
    vertical_scale = height / base_height
    horizontal_scale = width / base_width

    scaled = dict(style)
    scaled["size"] = max(36, round(style["size"] * font_scale))
    scaled["outline_size"] = max(1, round(style["outline_size"] * font_scale))
    scaled["shadow"] = max(0, round(style["shadow"] * font_scale))
    scaled["spacing"] = round(style["spacing"] * font_scale)
    scaled["margin_v"] = max(40, round((120 if position == "top" else 80) * vertical_scale))
    scaled["margin_h"] = max(20, round(20 * horizontal_scale))
    return scaled

def _hex_to_ass(hex_color: str) -> str:
    hex_color = hex_color.lstrip("#")
    r, g, b = hex_color[0:2], hex_color[2:4], hex_color[4:6]
    return f"&H00{b}{g}{r}".upper()

def _build_ass_header(style_name, position, aspect_ratio, font_scale=1.0, caption_color="#ffffff"):
    base_style = STYLE_PRESETS.get(style_name, STYLE_PRESETS["bold_impact"])
    if caption_color and caption_color != "#ffffff":
        base_style = dict(base_style)
        base_style["primary"] = _hex_to_ass(caption_color)
    width, height = ASPECT_RATIO_DIMENSIONS.get(aspect_ratio, ASPECT_RATIO_DIMENSIONS["9:16"])
    style = _scale_style_for_resolution(base_style, position, width, height, font_scale=font_scale)
    alignment = POSITION_TO_ALIGNMENT.get(position, POSITION_TO_ALIGNMENT["middle"])

    return f"""[Script Info]
ScriptType: v4.00+
PlayResX: {width}
PlayResY: {height}

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,{style['font']},{style['size']},{style['primary']},&H000000FF,{style['outline']},{style['back']},{style['bold']},{style['italic']},0,0,100,100,{style['spacing']},0,1,{style['outline_size']},{style['shadow']},{alignment},{style['margin_h']},{style['margin_h']},{style['margin_v']},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""


# ── TikTok-style caption tuning ──────────────────────────────────────────────
BASE_COLOR_ASS = "&H00FFFFFF"      # inactive words: white
DEFAULT_ACCENT_ASS = "&H0000FFFF"  # active word fallback: yellow
GAP_THRESHOLD = 0.55  # a pause longer than this clears the screen (silence)
MAX_PHRASE_WORDS = 3  # max words shown together
MAX_WORD_HOLD = 1.2   # cap how long a single word lingers (seconds)
TAIL = 0.3            # how long the last word of a phrase lingers before clearing


def _resolve_active_color(style_name, caption_color):
    """Color used to highlight the currently-spoken word."""
    if caption_color and caption_color.lstrip("#").lower() not in ("ffffff", "fff"):
        return _hex_to_ass(caption_color)
    preset = STYLE_PRESETS.get(style_name, STYLE_PRESETS["bold_impact"])
    primary = preset.get("primary", DEFAULT_ACCENT_ASS)
    if primary.upper() == BASE_COLOR_ASS:
        return DEFAULT_ACCENT_ASS
    return primary


def _phrase_layout(words):
    """
    Turn a flat [{word, time}] list into TikTok phrases.

    Returns a list of phrases, each a list of {word, start, end} (clip-relative
    seconds) that tile [start, end) with no gaps or overlaps inside the phrase.
    Silence between phrases is left uncovered so the screen clears.
    """
    cleaned = [
        {"word": str(w.get("word", "")).strip(), "time": float(w.get("time", 0.0))}
        for w in words
        if str(w.get("word", "")).strip()
    ]
    cleaned.sort(key=lambda w: w["time"])
    if not cleaned:
        return []

    times = [w["time"] for w in cleaned]
    n = len(cleaned)

    # End of each word's on-screen slot.
    ends = []
    for i in range(n):
        if i + 1 < n and (times[i + 1] - times[i]) <= GAP_THRESHOLD:
            end = times[i + 1]                 # next word takes over immediately
        else:
            end = times[i] + TAIL              # last word, or silence follows
        end = min(end, times[i] + MAX_WORD_HOLD)
        if end <= times[i]:
            end = times[i] + 0.05
        ends.append(end)

    phrases = []
    current = [0]
    for i in range(1, n):
        gap = times[i] - times[i - 1]
        if gap > GAP_THRESHOLD or len(current) >= MAX_PHRASE_WORDS:
            phrases.append(current)
            current = [i]
        else:
            current.append(i)
    phrases.append(current)

    layout = []
    for idx_group in phrases:
        layout.append([
            {"word": cleaned[i]["word"], "start": times[i], "end": ends[i]}
            for i in idx_group
        ])
    return layout


def words_to_ass(words, output_path, style_name="bold_impact", position="middle", aspect_ratio="9:16", font_scale=1.0, caption_color="#ffffff"):
    header = _build_ass_header(style_name, position, aspect_ratio, font_scale=font_scale, caption_color=caption_color)
    lines = [header]
    active_color = _resolve_active_color(style_name, caption_color)

    for phrase in _phrase_layout(words):
        # Reveal words progressively: at each word's timestamp, show the phrase
        # only up to (and including) that word, with the new word highlighted.
        # A word is never shown before it is actually spoken, and the slots tile
        # exactly so there is no flicker, overlap, or caption during silence.
        for active_idx, active_word in enumerate(phrase):
            start = active_word["start"]
            end = active_word["end"]
            parts = []
            for j in range(active_idx + 1):
                color = active_color if j == active_idx else BASE_COLOR_ASS
                parts.append(f"{{\\c{color}&}}{phrase[j]['word'].upper()}")
            text = " ".join(parts)
            lines.append(
                f"Dialogue: 0,{seconds_to_ass_time(start)},{seconds_to_ass_time(end)},Default,,0,0,0,,{text}"
            )

    with open(output_path, "w", encoding="utf-8") as file_handle:
        file_handle.write("\n".join(lines))


def process_clip(item, clips_dir, output_dir, style_name, position, aspect_ratio, font_scale=1.0, ffmpeg_threads: int | None = None, caption_color="#ffffff"):
    clip_id = item["highlight_id"]
    words = item["words"]

    clip_path = os.path.join(clips_dir, f"clip_{clip_id}.mp4")
    ass_path = os.path.join(output_dir, f"clip_{clip_id}.ass")
    output_path = os.path.join(output_dir, f"clip_{clip_id}_captioned.mp4")

    if not os.path.exists(clip_path):
        print(f"[Warning] Missing clip: {clip_path}")
        return

    words_to_ass(words, ass_path, style_name=style_name, position=position, aspect_ratio=aspect_ratio, font_scale=font_scale, caption_color=caption_color)
    ass_path_ffmpeg = os.path.abspath(ass_path).replace("\\", "/").replace(":", "\\:")

    command = [
        "ffmpeg",
        "-y",
        "-i",
        clip_path,
        "-vf",
        f"ass='{ass_path_ffmpeg}'",
        "-c:v",
        "libx264",
        "-preset",
        "ultrafast",
        "-crf",
        "23",
        "-c:a",
        "copy",
        output_path,
    ]
    if ffmpeg_threads is not None:
        # IMPORTANT: Must be "-threads <n>" (order matters).
        n = max(1, int(ffmpeg_threads))
        try:
            idx = command.index("libx264") + 1
        except ValueError:
            idx = command.index("-preset")
        command[idx:idx] = ["-threads", str(n)]
    subprocess.run(command, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    print(f"[Captioned] {output_path}")


def burn_captions(
    captions_file,
    clips_dir="outputs/clips",
    output_dir="outputs/captioned",
    style_name="bold_impact",
    position="middle",
    aspect_ratio="9:16",
    clip_ids=None,
    font_scale=1.0,
    max_workers: int | None = None,
    ffmpeg_threads: int | None = None,
    caption_color="#ffffff"
):
    os.makedirs(output_dir, exist_ok=True)

    with open(captions_file, "r", encoding="utf-8") as file_handle:
        captions_data = json.load(file_handle)

    if clip_ids is not None:
        clip_ids = {int(clip_id) for clip_id in clip_ids}
        captions_data = [item for item in captions_data if int(item["highlight_id"]) in clip_ids]

    if max_workers is None:
        cpu = os.cpu_count() or 4
        env_workers = os.getenv("AUTOREEL_FFMPEG_WORKERS")
        if env_workers and env_workers.isdigit():
            max_workers = max(1, int(env_workers))
        else:
            # Use available cores with one ffmpeg job per core (minus one for the OS).
            max_workers = max(1, cpu - 1)

    if captions_data:
        max_workers = max(1, min(int(max_workers), len(captions_data)))
    else:
        max_workers = 1

    if ffmpeg_threads is None:
        cpu = os.cpu_count() or 4
        ffmpeg_threads = max(1, cpu // max_workers)

    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        executor.map(
            lambda item: process_clip(
                item,
                clips_dir,
                output_dir,
                style_name,
                position,
                aspect_ratio,
                font_scale=font_scale,
                ffmpeg_threads=ffmpeg_threads,
                caption_color=caption_color,
            ),
            captions_data,
        )
