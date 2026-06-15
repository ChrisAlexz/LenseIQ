import json
import os
import re

# ─────────────────────────────────────────────────────────────────────────────
# Context patterns that indicate a summary/recap — NOT a live exciting moment
# ─────────────────────────────────────────────────────────────────────────────

# If any of these patterns appear in the segment text, the keyword score is
# heavily discounted. These are phrases commentators use when recapping or
# discussing the game state, not reacting to a live event.
# ─── SUMMARY / POST-GAME PATTERNS (signal the game is over or being recapped) ───

SUMMARY_PATTERNS = [
    # ── General (existing) ──
    r"\bends?\s+with\b",
    r"\bfinal\s+score\b",
    r"\bfull[\s-]time\b",
    r"\bhalf[\s-]time\b",
    r"\bat\s+the\s+(end|close)\b",
    r"\bso\s+far\b",
    r"\bin\s+total\b",
    r"\bover\s+the\s+(course|game|match)\b",
    r"\brecap\b",
    r"\bstatistic",
    r"\boverall\b",
    r"\btally\b",
    r"\bfinished\b.*\b\d+\b",
    r"\bended\b.*\b\d+\b",
    r"\bweeks?\s+without\s+a\s+goal\b",           # "weeks without a goal"
    r"\b\d+\s+weeks?\s+without\b",                 # "8 weeks without"
    r"\bmonths?\s+without\s+a\s+goal\b",           # "months without a goal"  
    r"\b\d+\s+(games?|matches?)\s+without\b",      # "5 games without"
    r"\bends?\s+(his|her|their)\s+drought\b",      # "ends his drought"
    r"\bfinally\s+broke?\s+(the\s+)?duck\b",       # British commentator slang
    r"\boff\s+the\s+mark\b",                       # "finally off the mark"

    # ── NBA ──
    r"\bfinal\s+buzzer\b",                      # "final buzzer sounds"
    r"\bgame\s+over\b",
    r"\bovertime\s+(final|result)\b",           # "overtime final"
    r"\b(wins|defeats|beats)\s+the\b",          # "Lakers wins the game"
    r"\bseries\s+(lead|tied|over)\b",           # "leads the series 3-1"
    r"\badvances\s+to\s+the\b",                 # "advances to the Finals"
    r"\beliminated\b",
    r"\bchampionship\s+(over|recap|final)\b",
    r"\bpostgame\b",
    r"\btriple[\s-]double\s+(line|final|with)\b", # "triple-double final line"
    r"\bended\s+with\s+\d+\s+points\b",         # "ended with 34 points"

    # ── Boxing / MMA ──
    r"\bby\s+(unanimous|split|majority)\s+decision\b",
    r"\bknocked\s+out\s+in\s+round\b",          # "knocked out in round 3"
    r"\btko\s+in\s+round\b",
    r"\bfight\s+(over|ended|result)\b",
    r"\bdefeat(ed|s)\s+\w+\s+by\b",             # "defeated Smith by KO"
    r"\bwins\s+by\s+(ko|tko|decision|submission)\b",
    r"\bfinal\s+round\b",
    r"\bfight\s+card\s+results?\b",
    r"\bofficial\s+(result|decision)\b",
    r"\bchampion\s+(retains?|wins?|defends?)\b",
    r"\bscorecard\b",

    # ── Tennis ──
    r"\bsets?\s+won\b",                         # "sets won: 3-1"
    r"\bmatch\s+point\b",                       # "match point converted"
    r"\bwins?\s+in\s+\d+\s+sets?\b",            # "wins in 4 sets"
    r"\bstraight\s+sets?\b",                    # "won in straight sets"
    r"\bretires?\b",                            # "opponent retires injured"
    r"\bwalkover\b",
    r"\bfinal\s+set\s+(score|tiebreak|result)\b",
    r"\badvances\s+to\s+the\s+(semi|quarter|final)\b",
    r"\b(defeated?|beat)\s+\w+\s+\d+-\d+\b",   # "defeated Nadal 6-3"
    r"\bservice\s+games?\s+(total|final)\b",

    # ── NFL / Football ──
    r"\bfinal\s+whistle\b",
    r"\bfull\s+time\s+result\b",
    r"\bgame\s+summary\b",
    r"\bend\s+of\s+(regulation|overtime|the\s+game)\b",
    r"\btouchdown\s+(total|tally|count)\b",
    r"\byards?\s+(total|gained|in\s+the\s+game)\b",
    r"\bpoints?\s+allowed\b",
    r"\bwins?\s+(the\s+super\s+bowl|the\s+game|the\s+division)\b",
    r"\bplayoff\s+(berth|picture|recap)\b",
    r"\bpasser\s+rating\s+(final|for\s+the\s+game)\b",
    r"\brushing\s+(total|yards?)\s+(final|in\s+the\s+game)\b",

    # ── Cricket ──
    r"\bfinal\s+score\s+\d+\b",
    r"\ball\s+out\s+for\b",                    # "all out for 243"
    r"\bends?\s+on\s+\d+\b",                  # "innings ends on 180"
    r"\binnings?\s+(over|complete|closed)\b",
    r"\bfollows?\s+on\b",
    r"\bdeclares?\b",                          # captain declares innings
    r"\bday\s+\d+\s+(close|stumps|result)\b", # "day 3 close"
    r"\bstumps\s+(drawn|called)\b",
    r"\bmatch\s+(drawn|result|over)\b",
    r"\bwon\s+by\s+\d+\s+(runs?|wickets?)\b", # "won by 45 runs"
    r"\bwon\s+the\s+(series|match|test)\b",

       # ── Spanish (all sports) ──
    r"\bmarcador\s+final\b",                   # "marcador final"
    r"\bresumen\b",                            # "resumen del partido"
    r"\bfinal\s+del\s+(partido|juego|encuentro)\b",
    r"\bterminó\s+\d+\b",                     # "terminó 2-1"
    r"\btermino\s+\d+\b",
    r"\bconcluye\s+el\s+partido\b",
    r"\bse\s+acaba\s+el\s+(partido|juego)\b",
    r"\btiempo\s+reglamentario\b",
    r"\bpitido\s+final\b",                    # final whistle in spanish
    r"\bganó\s+por\s+\d+\b",                  # "ganó por 2"
    r"\bgano\s+por\s+\d+\b",
    r"\bderrotó\s+a\b",                       # "derrotó al equipo"
    r"\bderroto\s+a\b",
    r"\bestadísticas\b",                      # "estadísticas del partido"
    r"\bestadisticas\b",
    r"\ben\s+total\s+\d+\b",
    r"\bganaron\s+(la\s+serie|el\s+partido)\b",
]


# ─── EXCITEMENT / LIVE MOMENT PATTERNS (signal a live peak moment) ───

EXCITEMENT_PATTERNS = [
    # ── General (existing) ──
    r"\bwhat\s+a\b",
    r"\boh+\b",
    r"\bwow\b",
    r"\bincredible\b",
    r"\bunbelievable\b",
    r"\bbrilliant\b",
    r"\bstunning\b",
    r"\bjust\s+(scored|saved|hit)\b",
    r"!{2,}",

    # ── NBA ──
    r"\bfrom\s+downtown\b",                     # deep three-pointer
    r"\band[\s-]one\b",                         # "and-one!"
    r"\bputback\b",                             # "putback slam!"
    r"\bslam\s+dunk\b",
    r"\bfade[\s-]away\b",
    r"\bbuzzer[\s-]beater\b",
    r"\bwith\s+the\s+clock\s+(dying|at\s+zero)\b",
    r"\bno[\s-]look\b",
    r"\balley[\s-]oop\b",
    r"\bin\s+his\s+face\b",                     # posterized dunk call
    r"\bthree[\s-]pointer\s+(hits?|drops?|splashes?)\b",
    r"\brejected\b",                            # blocked shot call

    # ── Boxing / MMA ──
    r"\bdown\s+goes\b",                         # "down goes Frazier!"
    r"\bhe'?s?\s+hurt\b",
    r"\bfloor\b.*\bknock\b",
    r"\bknocked?\s+down\b",
    r"\bstaggered\b",
    r"\bbloodie(d|s)\b",
    r"\bvicious\s+(hook|jab|uppercut|combination|kick)\b",
    r"\bfinish(es|ed)?\s+it\b",                 # "finishes it right here!"
    r"\bright\s+on\s+the\s+(chin|jaw|button)\b",
    r"\bhe\s+didn'?t\s+see\s+that\s+coming\b",

    # ── Tennis ──
    r"\bace\b",
    r"\b(un)?returnable\b",
    r"\bwinner\b.*\b(line|net|corner)\b",
    r"\bnet\s+cord\b",
    r"\bdeuce\b.*\b(again|point)\b",            # dramatic deuce situations
    r"\bgame[\s,]\s*set[\s,]\s*match\b",
    r"\bjust\s+(long|out|wide|in)\b",           # tight line calls
    r"\bletting\s+rip\b",
    r"\bblast(s|ed)?\s+(down|past|by)\b",

    # ── NFL / Football ──
    r"\bhail\s+mary\b",
    r"\bhe'?s?\s+gone\b",                       # breakaway run/catch
    r"\bpicked\s+off\b",
    r"\bpick[\s-]six\b",
    r"\bbreaks?\s+(free|away|loose)\b",
    r"\bcould[\s-]n'?t\s+be\s+stopped\b",
    r"\btackled\s+at\s+the\s+one\b",            # dramatic goal-line stop
    r"\bout\s+of\s+nowhere\b",
    r"\bgoes?\s+all\s+the\s+way\b",             # TD run call
    r"\bno\s+flag\s+on\s+the\s+play\b",
    r"\bsacked\b.*\b(hard|again|for\s+a\s+loss)\b",

    # ── Cricket ──
    r"\bsix(es)?\b",                           # "six! maximum!"
    r"\bwhat\s+a\s+(delivery|ball|catch)\b",
    r"\bclean\s+bowled\b",
    r"\bthrough\s+the\s+gate\b",              # classic bowled dismissal call
    r"\bback\s+of\s+a\s+length\b",
    r"\bdrop(ped)?\s+catch\b",                # dropped catch — drama
    r"\bno[\s-]ball\s+called\b",
    r"\bdirect\s+hit\b",                      # run out via direct hit
    r"\breviewing\b",                          # DRS review tension
    r"\bthird\s+umpire\b",
    r"\bmaximum\b",                            # six
    "\bsends?\s+him\s+(back|packing)\b",     # wicket call
    r"\bthrough\s+the\s+covers?\b",           # elegant boundary
    r"\bover\s+the\s+rope\b",

    # ── Spanish (all sports) ──
    r"\bqué\s+(golazo|jugada|pase|tiro|gol)\b",  # "¡qué golazo!"
    r"\bque\s+(golazo|jugada|pase|tiro|gol)\b",
    r"\bincreíble\b",
    r"\bincreible\b",
    r"\bespectacular\b",
    r"\bimpresionante\b",
    r"\bqué\s+barbaridad\b",
    r"\bque\s+barbaridad\b",
    r"\bno\s+puede\s+ser\b",                  # "¡no puede ser!"
    r"\bfuera\s+de\s+serie\b",               # "out of this world"
    r"\bse\s+va\s+solo\b",                   # breakaway call
    r"\bqué\s+manera\b",                     # "¡qué manera de marcar!"
    r"\bque\s+manera\b",
    r"\bmagistral\b",
    r"\bbrutal\b",
    r"¡+",                                   # Spanish exclamation marks
]

SUMMARY_DISCOUNT  = 0.15   # multiply score by this if summary detected (85% reduction)
EXCITEMENT_BOOST  = 1.5    # multiply score by this if excitement detected


def _is_summary(text: str) -> bool:
    """Returns True if the text looks like a recap rather than a live reaction."""
    t = text.lower()
    return any(re.search(p, t) for p in SUMMARY_PATTERNS)


def _excitement_multiplier(text: str) -> float:
    """Returns a boost multiplier if the text contains live excitement signals."""
    t = text.lower()
    if any(re.search(p, t) for p in EXCITEMENT_PATTERNS):
        return EXCITEMENT_BOOST
    return 1.0


def load_keyword_config(sport="soccer", language="en"):
    base_dir    = os.path.dirname(os.path.abspath(__file__))
    configs  = os.path.join(base_dir, "..", "configs")

    # Try language-specific config first (e.g. soccer_es_config.json)
    if language and language != "en":
        lang_path = os.path.join(configs, f"{sport}_{language}_config.json")
        if os.path.exists(lang_path):
            with open(lang_path, "r") as f:
                return json.load(f)
        print(f"[Linguistic] No {language} config for {sport}, falling back to English")

    # Fall back to English
    config_path = os.path.join(configs, f"{sport}_config.json")
    if not os.path.exists(config_path):
        raise FileNotFoundError(f"Keyword config not found for sport: {sport}")
    with open(config_path, "r") as f:
        return json.load(f)


def score_transcript(transcript_file, keyword_config):
    with open(transcript_file, "r") as f:
        transcript = json.load(f)
    return _score_segments_list(transcript, keyword_config)


def score_segments(segments: list, keyword_config: dict) -> list:
    """In-memory version used by the parallel pipeline."""
    return _score_segments_list(segments, keyword_config)


def _score_segments_list(segments: list, keyword_config: dict) -> list:
    """
    Shared scoring logic for both file-based and in-memory callers.

    Scoring pipeline per segment:
      1. Raw keyword score  — sum points for every keyword found in text
      2. Summary discount   — if text looks like a recap, multiply by 0.15
      3. Excitement boost   — if text has live excitement signals, multiply by 1.5
      4. Only keep segments with final score > 0
    """
    scored_events = []

    for segment in segments:
        text = segment["text"].lower()

        # Step 1 — raw keyword score
        raw_score = 0
        for keyword, value in keyword_config.items():
            if keyword in text:
                raw_score += value

        if raw_score == 0:
            continue

        # Step 2 — apply summary discount
        if _is_summary(text):
            raw_score *= SUMMARY_DISCOUNT

        # Step 3 — apply excitement boost
        raw_score *= _excitement_multiplier(text)

        final_score = round(raw_score, 2)

        if final_score > 0:
            scored_events.append({
                "start": segment["start"],
                "end":   segment["end"],
                "text":  segment["text"],
                "score": final_score,
            })

    return scored_events


# All functions below are unchanged
def merge_events(events, merge_threshold=5, max_clip_length=20):
    if not events:
        return []
    events.sort(key=lambda x: x["start"])
    merged = [events[0]]
    for event in events[1:]:
        last = merged[-1]
        if event["start"] - last["end"] <= merge_threshold:
            new_end = max(last["end"], event["end"])
            if new_end - last["start"] > max_clip_length:
                merged.append(event)
            else:
                merged[-1] = {
                    "start": last["start"],
                    "end":   new_end,
                    "text":  f"{last['text']} | {event['text']}",
                    "score": last["score"] + event["score"],
                }
        else:
            merged.append(event)
    return merged

def fuse_with_spikes(
    merged_events,
    spikes_path,
    spike_window=3,
    acoustic_weight=5,
    spike_threshold_db=-7.0,
    intensity_weight=1.5,
):
    if not os.path.exists(spikes_path):
        print(f"Warning: spikes file not found: {spikes_path}")
        return merged_events

    with open(spikes_path, "r") as f:
        spikes = json.load(f)

    final_events = []
    for event in merged_events:
        event_start    = event["start"]
        event_end      = event["end"]
        related_spikes = []

        for spike in spikes:
            spike_time = spike["time"]
            if (event_start - spike_window) <= spike_time <= (event_end + spike_window):
                related_spikes.append(spike)

        spike_count_boost = len(related_spikes) * acoustic_weight
        intensity_boost   = sum(
            max(0.0, float(spike.get("db", spike_threshold_db)) - spike_threshold_db)
            for spike in related_spikes
        ) * intensity_weight

        total_score = event["score"] + spike_count_boost + intensity_boost
        final_events.append({
            "start":                event_start,
            "end":                  event_end,
            "text":                 event["text"],
            "score":                round(total_score, 2),
            "keyword_score":        event["score"],
            "spike_count_boost":    spike_count_boost,
            "spike_intensity_boost": round(intensity_boost, 2),
            "spikes":               related_spikes,
        })

    final_events.sort(key=lambda e: (-e["score"], e["start"]))
    return final_events


def run_linguistic(transcript_file, output_file, sport="soccer", spikes_path=None):
    keyword_config  = load_keyword_config(sport)
    scored_events   = score_transcript(transcript_file, keyword_config)
    merged_events   = merge_events(scored_events)

    if spikes_path:
        final_events = fuse_with_spikes(merged_events, spikes_path)
    else:
        final_events = merged_events
        final_events.sort(key=lambda e: (-e["score"], e["start"]))

    with open(output_file, "w") as f:
        json.dump(final_events, f, indent=2)
    
    print(f"[Linguistic] Highlight candidates saved → {output_file}")