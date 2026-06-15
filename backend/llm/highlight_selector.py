import json
import os
import re
import urllib.error
import urllib.parse
import urllib.request


DEFAULT_PROVIDER = os.getenv("AI_PROVIDER", "").strip().lower() or "gemini"
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.0-flash").strip()
GEMINI_FALLBACK_MODELS = [
    model.strip()
    for model in os.getenv("GEMINI_FALLBACK_MODELS", "gemini-2.0-flash,gemini-1.5-flash-latest").split(",")
    if model.strip()
]
MAX_TRANSCRIPT_SEGMENTS = max(1, int(os.getenv("LLM_MAX_TRANSCRIPT_SEGMENTS", "4000")))
MAX_LLM_CANDIDATES = max(1, int(os.getenv("LLM_MAX_CANDIDATES", "12")))


def _serialize_transcript(segments: list[dict]) -> str:
    trimmed = segments[:MAX_TRANSCRIPT_SEGMENTS]
    lines = []
    for seg in trimmed:
        start = round(float(seg.get("start", 0.0)), 3)
        end = round(float(seg.get("end", 0.0)), 3)
        text = str(seg.get("text", "")).strip()
        if not text:
            continue
        lines.append(f"[{start:.3f}-{end:.3f}] {text}")
    return "\n".join(lines)


def _build_prompt(transcript_text: str, video_duration: float, topic: str = "") -> str:
    topic_line = f"\nThe user wants clips about: {topic}\nPrioritize moments that match this topic.\n" if topic.strip() else ""
    return f"""
You are selecting the most viral-ready clips from a transcript of a single video.
{topic_line}
Your task:
1. Read the full timestamped transcript.
2. Identify complete, self-contained viral moments.
3. Return exact clip windows that include the full setup, payoff, and reaction when present.
4. Do not return tiny keyword-only snippets.
5. Do not add padding outside the actual moment unless the transcript clearly supports it.
6. Prefer moments that are emotionally strong, surprising, dramatic, funny, controversial, highly informative, or strongly shareable.
7. Avoid duplicate or heavily overlapping clips.

Output requirements:
- Return JSON only.
- Return an object with a single key: "clips".
- "clips" must be an array of objects.
- Each clip object must have:
  - "start": number (seconds)
  - "end": number (seconds)
  - "score": number from 0 to 100
  - "reason": short string
  - "hook": short string summarizing why this clip is viral
- Keep each clip between 8 and 75 seconds when possible.
- Keep all timestamps within the video duration of {video_duration:.3f} seconds.
- Return at most {MAX_LLM_CANDIDATES} clips.

Transcript:
{transcript_text}
""".strip()


def _extract_json_object(raw_text: str) -> dict:
    text = raw_text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if not match:
            raise
        return json.loads(match.group(0))


def _validate_clips(payload: dict, video_duration: float) -> list[dict]:
    clips = payload.get("clips")
    if not isinstance(clips, list):
        raise ValueError("LLM response missing 'clips' array")

    validated = []
    for idx, clip in enumerate(clips):
        try:
            start = max(0.0, float(clip["start"]))
            end = min(float(video_duration), float(clip["end"]))
            score = float(clip.get("score", 0.0))
        except (KeyError, TypeError, ValueError) as exc:
            raise ValueError(f"Invalid clip at index {idx}: {exc}") from exc

        if end <= start:
            continue

        validated.append(
            {
                "start": round(start, 3),
                "end": round(end, 3),
                "score": round(max(0.0, min(score, 100.0)), 2),
                "text": str(clip.get("hook") or clip.get("reason") or "LLM-selected highlight").strip(),
                "reason": str(clip.get("reason") or "").strip(),
                "hook": str(clip.get("hook") or "").strip(),
            }
        )

    validated.sort(key=lambda item: (-item["score"], item["start"]))
    return validated


def _call_gemini(prompt: str) -> dict:
    if not GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY is not configured")

    models_to_try = []
    for model in [GEMINI_MODEL, *GEMINI_FALLBACK_MODELS]:
        if model and model not in models_to_try:
            models_to_try.append(model)

    last_error = None
    for model in models_to_try:
        endpoint = (
            "https://generativelanguage.googleapis.com/v1beta/models/"
            f"{urllib.parse.quote(model)}:generateContent"
        )
        params = urllib.parse.urlencode({"key": GEMINI_API_KEY})
        body = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "temperature": 0.2,
                "responseMimeType": "application/json",
            },
        }
        request = urllib.request.Request(
            f"{endpoint}?{params}",
            data=json.dumps(body).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )

        try:
            with urllib.request.urlopen(request, timeout=120) as response:
                payload = json.loads(response.read().decode("utf-8"))
            candidates = payload.get("candidates") or []
            if not candidates:
                raise ValueError("Gemini returned no candidates")

            parts = candidates[0].get("content", {}).get("parts", [])
            text = "".join(str(part.get("text", "")) for part in parts).strip()
            if not text:
                raise ValueError("Gemini returned an empty response")

            return _extract_json_object(text)
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")
            last_error = RuntimeError(f"Gemini model '{model}' HTTP {exc.code}: {detail}")
            if exc.code == 404:
                continue
            raise last_error from exc
        except urllib.error.URLError as exc:
            raise RuntimeError(f"Gemini request failed: {exc}") from exc
        except Exception as exc:
            last_error = exc
            raise

    if last_error:
        raise last_error
    raise RuntimeError("Gemini request failed before a model could be tried")


def generate_hashtags_with_llm(
    sport: str,
    topic: str = "",
    highlights: list[dict] | None = None,
) -> list[str]:
    if not GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY is not configured")

    hooks = ""
    if highlights:
        hook_lines = [h.get("hook") or h.get("text") or h.get("reason") for h in highlights if h]
        hooks = "\n".join(f"- {line}" for line in hook_lines if line)

    sport_line = ""
    if sport and sport.strip() and sport.strip().lower() not in {"general", "any", "any-content"}:
        sport_line = f"\nDetected category: {sport}"
    topic_line = f"\nTopic/theme of the video: {topic}" if topic.strip() else ""
    hooks_section = f"\nKey moments detected:\n{hooks}" if hooks else ""

    prompt = f"""Generate 15 highly relevant social media hashtags for a viral video clip.

Use the available context to infer the best tags for the content, even if it is not sports.
{sport_line}{topic_line}{hooks_section}

Rules:
- Return ONLY a JSON object with a single key "hashtags" containing an array of strings.
- Each string must start with #.
- Mix broad viral tags with content-specific, audience-specific, and topic-specific tags.
- Always include #LENSEIQ as one of the tags.
- No duplicates, no explanations.

Example format: {{"hashtags": ["#SportHighlights", "#Viral", "#LENSEIQ"]}}""".strip()
    data = _call_gemini(prompt)
    tags = data.get("hashtags", [])
    if not isinstance(tags, list):
        raise ValueError("Invalid hashtag response format")
    return [str(t).strip() for t in tags if str(t).strip()]


def select_highlights_with_llm(
    segments: list[dict],
    video_duration: float,
    provider: str | None = None,
    topic: str = "",
) -> list[dict]:
    chosen_provider = (provider or DEFAULT_PROVIDER).strip().lower()
    if chosen_provider != "gemini":
        raise ValueError(f"Unsupported AI provider: {chosen_provider}")

    transcript_text = _serialize_transcript(segments)
    if not transcript_text:
        return []

    prompt = _build_prompt(transcript_text, video_duration, topic=topic)
    payload = _call_gemini(prompt)
    return _validate_clips(payload, video_duration)
