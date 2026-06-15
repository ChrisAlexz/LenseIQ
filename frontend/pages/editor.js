import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import GridBackground from "../components/GridBackground";
import { bumpClipVersion, persistClipSettings } from "../components/HighlightPlayer";
import { getToken } from "../services/auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

const CAPTION_STYLE_OPTIONS = [
  { value: "clean_modern", label: "Default" },
  { value: "typewriter", label: "Mono" },
  { value: "classic_serif", label: "Serif" },
  { value: "bold_impact", label: "Bold" },
  { value: "neon_pop", label: "Casual" },
];

const CAPTION_POSITION_OPTIONS = [
  { value: "top", label: "Top" },
  { value: "middle", label: "Middle" },
  { value: "bottom", label: "Bottom" },
];

const CAPTION_PREVIEW_STYLE = {
  clean_modern: {
    fontFamily: "Arial, sans-serif",
    fontWeight: 700,
    color: "#ffffff",
    WebkitTextStroke: "2px rgba(0, 0, 0, 0.9)",
    textShadow: "0 2px 10px rgba(0,0,0,0.55)",
    letterSpacing: "0.01em",
  },
  typewriter: {
    fontFamily: "'Courier New', monospace",
    fontWeight: 700,
    color: "#ffffff",
    WebkitTextStroke: "2px rgba(0, 0, 0, 0.9)",
    textShadow: "0 2px 8px rgba(0,0,0,0.45)",
    letterSpacing: "0.02em",
  },
  classic_serif: {
    fontFamily: "Georgia, serif",
    fontWeight: 700,
    color: "#f5f5f5",
    WebkitTextStroke: "1.5px rgba(0, 0, 0, 0.85)",
    textShadow: "0 2px 8px rgba(0,0,0,0.4)",
    letterSpacing: "0.01em",
  },
  bold_impact: {
    fontFamily: "Impact, Haettenschweiler, 'Arial Narrow Bold', sans-serif",
    fontWeight: 800,
    color: "#faff33",
    WebkitTextStroke: "3px rgba(0, 0, 0, 0.95)",
    textShadow: "0 4px 14px rgba(0,0,0,0.6)",
    letterSpacing: "-0.03em",
  },
  neon_pop: {
    fontFamily: "'Trebuchet MS', 'Comic Sans MS', cursive",
    fontWeight: 800,
    color: "#66ff9b",
    WebkitTextStroke: "2px rgba(0, 0, 0, 0.9)",
    textShadow: "0 0 16px rgba(102,255,155,0.65), 0 2px 10px rgba(0,0,0,0.45)",
    letterSpacing: "0.02em",
  },
};

function getCaptionPlacement(position) {
  if (position === "top") return { top: "10%", transform: "translate(-50%, 0)" };
  if (position === "bottom") return { bottom: "10%", transform: "translate(-50%, 0)" };
  return { top: "50%", transform: "translate(-50%, -50%)" };
}

function buildClipSrc(jobId, clipIndex, version) {
  // Always preview against the raw (non-captioned) clip to avoid "double captions"
  // while the user adjusts style/position/font size.
  const clipPath = `${jobId}/clips/clip_${clipIndex}.mp4`;
  const token = getToken() || "";
  return `${API_URL}/clips/${clipPath}?v=${version}&token=${encodeURIComponent(token)}`;
}

export default function EditorPage() {
  const router = useRouter();
  const videoRef = useRef(null);

  const { job_id, clip, aspect, cap, style, pos, fs } = router.query;
  const clipIndex = Number.isFinite(Number(clip)) ? Number(clip) : null;
  const aspectRatio = aspect === "16:9" ? "16:9" : "9:16";

  const [captionEnabled, setCaptionEnabled] = useState(cap !== "false");
  const [captionStyle, setCaptionStyle] = useState(typeof style === "string" ? style : "bold_impact");
  const [captionPosition, setCaptionPosition] = useState(typeof pos === "string" ? pos : "middle");
  const initialFs = typeof fs === "string" ? Number(fs) : 1.0;
  const [fontScale, setFontScale] = useState(Number.isFinite(initialFs) ? Math.min(1.8, Math.max(0.6, initialFs)) : 1.0);

  const [activeTab, setActiveTab] = useState("captions"); // captions | trim
  const [previewMode, setPreviewMode] = useState("video"); // video | frame
  const [frameSrc, setFrameSrc] = useState("");
  const [frameTime, setFrameTime] = useState(0);

  const [captionWords, setCaptionWords] = useState([]);
  const [captionText, setCaptionText] = useState("");
  const [isEditingCaption, setIsEditingCaption] = useState(false);

  const [duration, setDuration] = useState(null);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(null);

  const [savingCaptions, setSavingCaptions] = useState(false);
  const [captionMessage, setCaptionMessage] = useState("");
  const [trimming, setTrimming] = useState(false);
  const [trimError, setTrimError] = useState("");

  const [version, setVersion] = useState(Date.now());

  useEffect(() => {
    if (cap === undefined) return;
    setCaptionEnabled(cap !== "false");
  }, [cap]);

  useEffect(() => {
    if (typeof style === "string") setCaptionStyle(style);
    if (typeof pos === "string") setCaptionPosition(pos);
    if (typeof fs === "string") {
      const next = Number(fs);
      if (Number.isFinite(next)) setFontScale(Math.min(1.8, Math.max(0.6, next)));
    }
  }, [style, pos, fs]);

  useEffect(() => {
    setDuration(null);
    setTrimStart(0);
    setTrimEnd(null);
    setTrimError("");
    setCaptionMessage("");
    setVersion(Date.now());
    setFrameSrc("");
  }, [job_id, clip, aspect, cap, style, pos, fs]);

  const clipSrc =
    job_id && clipIndex !== null
      ? buildClipSrc(job_id, clipIndex, version)
      : "";

  const placement = getCaptionPlacement(captionPosition);
  const previewStyle = CAPTION_PREVIEW_STYLE[captionStyle] || CAPTION_PREVIEW_STYLE.bold_impact;
  const overlayFontSize =
    aspectRatio === "16:9"
      ? `clamp(${Math.round(18 * fontScale)}px, ${2.5 * fontScale}vw, ${Math.round(44 * fontScale)}px)`
      : `clamp(${Math.round(18 * fontScale)}px, ${3.8 * fontScale}vw, ${Math.round(54 * fontScale)}px)`;

  const videoBoxStyle =
    aspectRatio === "16:9"
      ? { width: "min(1100px, 100%)", maxHeight: "100%", aspectRatio: "16 / 9" }
      : { height: "100%", width: "auto", maxWidth: "100%", maxHeight: "100%", aspectRatio: "9 / 16" };

  const captureFrame = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    const w = v.videoWidth;
    const h = v.videoHeight;
    if (!w || !h) return;

    try {
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(v, 0, 0, w, h);
      setFrameSrc(canvas.toDataURL("image/jpeg", 0.86));
      setFrameTime(v.currentTime || 0);
    } catch {
      // Canvas can be blocked by CORS; in that case, video preview still works.
    }
  }, []);

  const computeCaptionTextAtTime = useCallback(
    (t) => {
      if (!captionWords || captionWords.length === 0) return "";
      // Mirror backend burn behavior: rolling window of last 3 words.
      let i = -1;
      for (let idx = 0; idx < captionWords.length; idx++) {
        if (Number(captionWords[idx]?.time) <= t) i = idx;
        else break;
      }
      if (i < 0) return "";
      const start = Math.max(0, i - 2);
      const window = captionWords.slice(start, i + 1);
      return window.map((w) => String(w.word || "").toUpperCase()).filter(Boolean).join(" ");
    },
    [captionWords],
  );

  const syncCaptionFromVideoTime = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    setCaptionText(computeCaptionTextAtTime(v.currentTime || 0));
  }, [computeCaptionTextAtTime]);

const handleCaptionTextChange = (newText) => {
  // 1. Update local UI state immediately
  setCaptionText(newText);

  const v = videoRef.current;
  if (!v || !captionWords.length) return;

  const t = v.currentTime;
  let i = -1;
  for (let idx = 0; idx < captionWords.length; idx++) {
    if (Number(captionWords[idx]?.time) <= t) i = idx;
    else break;
  }
  if (i < 0) return;

  const windowStart = Math.max(0, i - 2);
  
  // Split by spaces but filter out empty strings so we don't 
  // corrupt the word data with "half-typed" spaces.
  const inputWords = newText.trim().split(/\s+/).filter(Boolean);

  setCaptionWords((prev) => {
    const updated = [...prev];
    const windowEnd = i;
    for (let targetIdx = windowStart; targetIdx <= windowEnd; targetIdx++) {
      if (!updated[targetIdx]) continue;
      const nextWord = inputWords[targetIdx - windowStart] ?? "";
      updated[targetIdx] = { ...updated[targetIdx], word: nextWord };
    }
    return updated;
  });
};


  useEffect(() => {
    async function loadWords() {
      if (!job_id || clipIndex === null) return;
      try {
        const res = await fetch(`${API_URL}/api/captions/${job_id}/${clipIndex}/words`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        const words = Array.isArray(data.words) ? data.words : [];
        setCaptionWords(words);
      } catch {
        // ignore
      }
    }
    loadWords();
  }, [job_id, clipIndex]);

  useEffect(() => {
    // When words load (or change), update overlay at the current time.
    if (isEditingCaption) return;
    syncCaptionFromVideoTime();
  }, [captionWords, syncCaptionFromVideoTime, isEditingCaption]);

  async function applyCaptions() {
    if (!job_id || clipIndex === null) return;
    setSavingCaptions(true);
    setCaptionMessage("");
    try {
      const form = new FormData();
      form.append("caption_enabled", String(captionEnabled));
      form.append("caption_style", captionStyle);
      form.append("caption_position", captionPosition);
      form.append("aspect_ratio", aspectRatio);
      form.append("caption_font_scale", String(fontScale));

      form.append("words", JSON.stringify(captionWords));

      const res = await fetch(`${API_URL}/api/captions/${job_id}/${clipIndex}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}` },
        body: form,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to update captions");
      }

      const data = await res.json();
      setCaptionEnabled(Boolean(data.caption_enabled));
      setCaptionMessage(Boolean(data.caption_enabled) ? "Captions updated for this clip." : "Captions removed for this clip.");
      setVersion(Date.now());
      persistClipSettings(job_id, clipIndex, {
        caption_enabled: Boolean(data.caption_enabled),
        caption_style: captionStyle,
        caption_position: captionPosition,
        caption_font_scale: fontScale,
      });
      bumpClipVersion(job_id, clipIndex);
    } catch (e) {
      setCaptionMessage(e.message || "Failed to update captions");
    } finally {
      setSavingCaptions(false);
    }
  }

  async function applyTrim() {
    if (!job_id || clipIndex === null || trimEnd === null) return;
    setTrimming(true);
    setTrimError("");
    try {
      const form = new FormData();
      form.append("job_dir", job_id);
      form.append("start", trimStart.toFixed(3));
      form.append("end", trimEnd.toFixed(3));

      const res = await fetch(`${API_URL}/api/trim/${clipIndex}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}` },
        body: form,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Trim failed");
      }

      const nextDuration = Math.max(trimEnd - trimStart, 0);
      setDuration(nextDuration);
      setTrimStart(0);
      setTrimEnd(nextDuration);
      setVersion(Date.now());
      bumpClipVersion(job_id, clipIndex);
    } catch (e) {
      setTrimError(e.message || "Trim failed");
    } finally {
      setTrimming(false);
    }
  }

  async function previewTrim() {
    const v = videoRef.current;
    if (!v || trimEnd === null) return;
    const stopAt = Math.max(trimStart, trimEnd);
    v.currentTime = trimStart;

    const onTime = () => {
      if (v.currentTime >= stopAt) {
        v.pause();
        v.removeEventListener("timeupdate", onTime);
      }
    };
    v.addEventListener("timeupdate", onTime);
    await v.play().catch(() => {
      v.removeEventListener("timeupdate", onTime);
    });
  }

  return (
    <GridBackground subtle>
      <div className="h-screen flex flex-col">
        <div className="px-6 pt-32 pb-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-[#86868b]">Editor</p>
              <p className="text-lg font-bold text-[#1d1d1f]">Clip {clipIndex !== null ? clipIndex + 1 : ""}</p>
            </div>
            <button
              type="button"
              onClick={() => router.back()}
              className="px-4 py-2 rounded-lg bg-[#e8e8ed] hover:bg-[#d2d2d7] text-[#86868b] hover:text-[#1d1d1f] text-sm font-medium transition"
            >
              Back
            </button>
          </div>
        </div>

        <div className="flex-1 px-6 pb-6 min-h-0">
          <div className="rounded-3xl border border-[#d2d2d7] bg-white shadow-sm overflow-hidden h-full min-h-0">
            <div className="grid grid-cols-1 lg:grid-cols-[420px_1fr] h-full">
              <div className="border-b lg:border-b-0 lg:border-r border-[#e5e5ea] p-5 flex flex-col overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm font-semibold text-[#1d1d1f]">Controls</p>
                  <span className="text-xs text-[#86868b]">{aspectRatio}</span>
                </div>

                <div className="flex items-center gap-2 mb-4">
                  <button
                    type="button"
                    onClick={() => setActiveTab("captions")}
                    className={`flex-1 py-2.5 rounded-xl text-xs font-bold tracking-wide border transition ${
                      activeTab === "captions"
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white text-[#1d1d1f] border-[#d2d2d7] hover:bg-[#f5f5f7]"
                    }`}
                  >
                    Captions
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("trim")}
                    className={`flex-1 py-2.5 rounded-xl text-xs font-bold tracking-wide border transition ${
                      activeTab === "trim"
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white text-[#1d1d1f] border-[#d2d2d7] hover:bg-[#f5f5f7]"
                    }`}
                  >
                    Trim
                  </button>
                </div>

                <div className="flex-1">

                  {activeTab === "captions" ? (
                    <div className="rounded-xl border border-[#e8e8ed] bg-[#fafafa] p-4">
                      <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-[#86868b]">Captions</p>
                      <div className="grid grid-cols-2 gap-2 mb-3">
                        <button
                          type="button"
                          onClick={() => setCaptionEnabled(true)}
                          className={`px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                            captionEnabled ? "bg-blue-600 text-white" : "bg-white text-[#86868b] border border-[#d2d2d7]"
                          }`}
                        >
                          On
                        </button>
                        <button
                          type="button"
                          onClick={() => setCaptionEnabled(false)}
                          className={`px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                            !captionEnabled ? "bg-blue-600 text-white" : "bg-white text-[#86868b] border border-[#d2d2d7]"
                          }`}
                        >
                          Off
                        </button>
                      </div>

                      <div className="grid grid-cols-1 gap-3">
                        <label className="block">
                          <span className="mb-2 block text-[11px] font-semibold uppercase tracking-widest text-[#86868b]">Style</span>
                          <select
                            value={captionStyle}
                            onChange={(e) => setCaptionStyle(e.target.value)}
                            disabled={!captionEnabled}
                            className="w-full rounded-lg border border-[#d2d2d7] bg-white px-3 py-2.5 text-sm text-[#1d1d1f] disabled:bg-[#f5f5f7] disabled:text-[#86868b]"
                          >
                            {CAPTION_STYLE_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className="block">
                          <span className="mb-2 block text-[11px] font-semibold uppercase tracking-widest text-[#86868b]">Position</span>
                          <select
                            value={captionPosition}
                            onChange={(e) => setCaptionPosition(e.target.value)}
                            disabled={!captionEnabled}
                            className="w-full rounded-lg border border-[#d2d2d7] bg-white px-3 py-2.5 text-sm text-[#1d1d1f] disabled:bg-[#f5f5f7] disabled:text-[#86868b]"
                          >
                            {CAPTION_POSITION_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </label>

                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[11px] font-semibold uppercase tracking-widest text-[#86868b]">Font Size</span>
                            <span className="text-xs font-mono text-[#86868b]">{Math.round(fontScale * 100)}%</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setFontScale((v) => Math.max(0.6, Math.round((v - 0.05) * 100) / 100))}
                              className="w-10 h-10 rounded-lg bg-white border border-[#d2d2d7] text-[#1d1d1f] font-semibold"
                              disabled={!captionEnabled}
                            >
                              -
                            </button>
                            <input
                              type="range"
                              min="0.6"
                              max="1.8"
                              step="0.05"
                              value={fontScale}
                              onChange={(e) => setFontScale(Number(e.target.value))}
                              disabled={!captionEnabled}
                              className="flex-1"
                            />
                            <button
                              type="button"
                              onClick={() => setFontScale((v) => Math.min(1.8, Math.round((v + 0.05) * 100) / 100))}
                              className="w-10 h-10 rounded-lg bg-white border border-[#d2d2d7] text-[#1d1d1f] font-semibold"
                              disabled={!captionEnabled}
                            >
                              +
                            </button>
                          </div>
                        </div>
                      </div>

                        <div className="mt-4">
                          <span className="mb-2 block text-[11px] font-semibold uppercase tracking-widest text-[#86868b]">
                          Edit Text
                          </span>
                          <textarea
                            value={captionText}
                            onChange={(e) => handleCaptionTextChange(e.target.value)}
                            onFocus={() => {
                              setIsEditingCaption(true);
                              videoRef.current?.pause();
                            }}
                            onBlur={() => {
                              setIsEditingCaption(false);
                              syncCaptionFromVideoTime();
                            }}
                            disabled={!captionEnabled}
                            className="w-full h-24 rounded-lg border border-[#d2d2d7] bg-white px-3 py-2 text-sm text-[#1d1d1f] focus:ring-2 focus:ring-blue-500 outline-none resize-none disabled:bg-[#f5f5f7] disabled:text-[#86868b]"
                            placeholder="No captions found at this timestamp..."
                          />
                          <p className="mt-1 text-[10px] text-[#86868b]">
                            Editing will update the current group of words.
                          </p>
                        </div>
                      
                      <p className="mt-3 text-xs text-[#86868b]">{captionMessage || "Preview updates live on the right."}</p>
                      <button
                        type="button"
                        onClick={applyCaptions}
                        disabled={savingCaptions}
                        className="w-full mt-3 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold tracking-wide transition-colors"
                      >
                        {savingCaptions ? "Updating..." : "Apply Captions"}
                      </button>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-[#e8e8ed] bg-[#fafafa] p-4">
                      <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-[#86868b]">Trim</p>
                      <div className="grid grid-cols-2 gap-3 mb-2">
                        <label className="block">
                          <span className="mb-2 block text-[11px] font-semibold uppercase tracking-widest text-[#86868b]">Start</span>
                          <input
                            type="number"
                            min="0"
                            step="0.1"
                            value={trimStart}
                            onChange={(e) => setTrimStart(Number(e.target.value))}
                            className="w-full rounded-lg border border-[#d2d2d7] bg-white px-3 py-2.5 text-sm"
                          />
                        </label>
                        <label className="block">
                          <span className="mb-2 block text-[11px] font-semibold uppercase tracking-widest text-[#86868b]">End</span>
                          <input
                            type="number"
                            min="0"
                            step="0.1"
                            value={trimEnd ?? ""}
                            onChange={(e) => setTrimEnd(Number(e.target.value))}
                            className="w-full rounded-lg border border-[#d2d2d7] bg-white px-3 py-2.5 text-sm"
                          />
                        </label>
                      </div>
                      {trimError && <p className="text-[11px] text-red-400 mt-1">{trimError}</p>}
                      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={previewTrim}
                          disabled={trimming || trimEnd === null}
                          className="py-2.5 rounded-lg bg-white border border-[#d2d2d7] text-[#1d1d1f] text-xs font-bold tracking-wide transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Preview Trim
                        </button>
                        <button
                          type="button"
                          onClick={applyTrim}
                          disabled={trimming || trimEnd === null}
                          className="py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold tracking-wide transition-colors"
                        >
                          {trimming ? "Trimming..." : "Apply Trim"}
                        </button>
                      </div>
                      <p className="mt-3 text-xs text-[#86868b]">Tip: Preview Trim plays only the selected range.</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="p-5 bg-[#fafafa] flex flex-col min-h-0">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold text-[#1d1d1f]">Preview</p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPreviewMode("video")}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                        previewMode === "video"
                          ? "bg-blue-600 text-white border-blue-600"
                          : "bg-white text-[#1d1d1f] border-[#d2d2d7] hover:bg-[#f5f5f7]"
                      }`}
                    >
                      Video
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPreviewMode("frame");
                        if (!frameSrc) captureFrame();
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                        previewMode === "frame"
                          ? "bg-blue-600 text-white border-blue-600"
                          : "bg-white text-[#1d1d1f] border-[#d2d2d7] hover:bg-[#f5f5f7]"
                      }`}
                    >
                      Frame
                    </button>
                  </div>
                </div>

                <div className="flex-1 min-h-0 flex items-center justify-center">
                  <div style={videoBoxStyle} className="rounded-2xl overflow-hidden border border-[#d2d2d7] bg-black relative">
                    {clipSrc && previewMode === "video" && (
                      <video
                        ref={videoRef}
                        key={clipSrc}
                        crossOrigin="anonymous"
                        className="w-full h-full object-cover"
                        controls
                        preload="metadata"
                        onLoadedMetadata={(e) => {
                          const nextDuration = e.currentTarget.duration;
                          if (Number.isFinite(nextDuration) && nextDuration > 0) {
                            setDuration(nextDuration);
                            setTrimStart(0);
                            setTrimEnd(nextDuration);
                            const t = Math.min(1, nextDuration / 3);
                            if (t > 0) e.currentTarget.currentTime = t;
                          }
                          syncCaptionFromVideoTime();
                        }}
                        onSeeked={() => {
                          captureFrame();
                          syncCaptionFromVideoTime();
                        }}
                        onTimeUpdate={() => {
                          // Live caption preview with the actual words for this clip.
                          if (!captionEnabled) return;
                          syncCaptionFromVideoTime();
                        }}
                      >
                        <source src={clipSrc} type="video/mp4" />
                      </video>
                    )}

                    {clipSrc && previewMode === "frame" && (
                      <>
                        {frameSrc ? (
                          <img src={frameSrc} alt="Frame preview" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-sm text-white/70 px-6 text-center">
                            Loading frame preview...
                          </div>
                        )}
                      </>
                    )}

                    <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-black/10 pointer-events-none" />
                    {captionEnabled && (
                      <div className="absolute left-1/2 w-[82%] text-center uppercase pointer-events-none" style={placement}>
                        <div style={{ ...previewStyle, fontSize: overlayFontSize }} className="inline-block max-w-full leading-[0.92]">
                          {previewMode === "frame" ? computeCaptionTextAtTime(frameTime) || captionText : captionText || " "}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </GridBackground>
  );
}
