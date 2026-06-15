import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { motion } from "framer-motion";
import { getToken } from "../services/auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

const ASPECT_RATIO_CLASS = {
  "9:16": "aspect-[9/16]",
  "16:9": "aspect-video",
};

function safeJsonParse(value, fallback) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function clipSettingsKey(jobId) {
  return `lenseiq:clipSettings:${jobId}`;
}

function clipVersionsKey(jobId) {
  return `lenseiq:clipVersions:${jobId}`;
}

function readClipSettings(jobId) {
  if (!jobId || typeof window === "undefined") return {};
  return safeJsonParse(localStorage.getItem(clipSettingsKey(jobId)), {});
}

function readClipVersions(jobId) {
  if (!jobId || typeof window === "undefined") return {};
  return safeJsonParse(localStorage.getItem(clipVersionsKey(jobId)), {});
}

function writeClipSettings(jobId, nextSettings) {
  if (!jobId || typeof window === "undefined") return;
  localStorage.setItem(clipSettingsKey(jobId), JSON.stringify(nextSettings));
}

function writeClipVersions(jobId, nextVersions) {
  if (!jobId || typeof window === "undefined") return;
  localStorage.setItem(clipVersionsKey(jobId), JSON.stringify(nextVersions));
}

export function bumpClipVersion(jobId, clipIndex) {
  if (!jobId || typeof window === "undefined") return;
  const versions = readClipVersions(jobId);
  versions[String(clipIndex)] = Date.now();
  writeClipVersions(jobId, versions);
  window.dispatchEvent(new CustomEvent("lenseiq:clip-updated", { detail: { jobId, clipIndex } }));
}

export function persistClipSettings(jobId, clipIndex, partial) {
  if (!jobId || typeof window === "undefined") return;
  const settings = readClipSettings(jobId);
  const key = String(clipIndex);
  settings[key] = { ...(settings[key] || {}), ...partial, updated_at: Date.now() };
  writeClipSettings(jobId, settings);
  window.dispatchEvent(new CustomEvent("lenseiq:clip-updated", { detail: { jobId, clipIndex } }));
}

function buildClipSrc({ jobId, clipIndex, captionEnabled, version }) {
  const clipPath = captionEnabled
    ? `${jobId}/captioned/clip_${clipIndex}_captioned.mp4`
    : `${jobId}/clips/clip_${clipIndex}.mp4`;
  const token = getToken() || "";
  return `${API_URL}/clips/${clipPath}?v=${version || 0}&token=${encodeURIComponent(token)}`;
}

function HighlightCard({ index, rank, delay, clipSrc, aspectRatio, score, onEdit }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="rounded-2xl overflow-hidden border border-[#d2d2d7] bg-white hover:border-blue-500/30 hover:shadow-md transition-all duration-300 shadow-sm"
    >
      <div className={`relative bg-black w-full ${ASPECT_RATIO_CLASS[aspectRatio] || ASPECT_RATIO_CLASS["9:16"]} overflow-hidden`}>
        <video className="w-full h-full object-cover" controls preload="metadata">
          <source src={clipSrc} type="video/mp4" />
        </video>

        <div className="absolute top-3 left-3 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-sm border border-white/10 text-[11px] font-bold text-white tabular-nums">
          #{rank}
        </div>

        <button
          type="button"
          onClick={onEdit}
          className="absolute top-3 right-3 px-2.5 py-1.5 rounded-lg bg-black/60 backdrop-blur-sm border border-white/10 text-[11px] font-semibold text-white hover:bg-black/80 transition-all"
          title="Edit clip"
        >
          Edit
        </button>
      </div>

      <div className="px-4 py-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <span className="text-sm font-semibold text-[#1d1d1f] truncate block">Highlight {rank}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {score !== null && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 tabular-nums">
              {score}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export default function HighlightPlayer({
  highlights = [],
  captionEnabled = true,
  job_id,
  aspectRatio = "9:16",
  initialCaptionStyle = "bold_impact",
  initialCaptionPosition = "middle",
  onCaptionStateChange,
}) {
  const router = useRouter();

  const [settingsByIndex, setSettingsByIndex] = useState({});
  const [versionsByIndex, setVersionsByIndex] = useState({});

  const refreshFromStorage = useCallback(() => {
    if (!job_id) return;
    setSettingsByIndex(readClipSettings(job_id));
    setVersionsByIndex(readClipVersions(job_id));
  }, [job_id]);

  useEffect(() => {
    refreshFromStorage();
  }, [refreshFromStorage]);

  useEffect(() => {
    const onUpdated = () => refreshFromStorage();
    const onVisibility = () => {
      if (!document.hidden) refreshFromStorage();
    };
    window.addEventListener("lenseiq:clip-updated", onUpdated);
    window.addEventListener("focus", onUpdated);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("lenseiq:clip-updated", onUpdated);
      window.removeEventListener("focus", onUpdated);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [refreshFromStorage]);

  const effective = useCallback(
    (index) => {
      const entry = settingsByIndex[String(index)] || {};
      return {
        caption_enabled:
          Object.prototype.hasOwnProperty.call(entry, "caption_enabled") ? Boolean(entry.caption_enabled) : Boolean(captionEnabled),
        caption_style: entry.caption_style || initialCaptionStyle,
        caption_position: entry.caption_position || initialCaptionPosition,
        caption_font_scale:
          typeof entry.caption_font_scale === "number" && Number.isFinite(entry.caption_font_scale) ? entry.caption_font_scale : 1.0,
        version: versionsByIndex[String(index)] || 0,
      };
    },
    [settingsByIndex, versionsByIndex, captionEnabled, initialCaptionStyle, initialCaptionPosition],
  );

  const clipCards = useMemo(() => {
    return highlights.map((highlight, index) => {
      const eff = effective(index);
      const score = highlight?.score !== undefined ? Number(highlight.score).toFixed(2) : null;
      const clipSrc = buildClipSrc({
        jobId: job_id,
        clipIndex: index,
        captionEnabled: eff.caption_enabled,
        version: eff.version,
      });

      return {
        index,
        rank: index + 1,
        delay: index * 0.05,
        score,
        clipSrc,
        settings: eff,
      };
    });
  }, [highlights, effective, job_id]);

  useEffect(() => {
    if (typeof onCaptionStateChange !== "function") return;
    onCaptionStateChange({
      captionEnabled,
      captionStyle: initialCaptionStyle,
      captionPosition: initialCaptionPosition,
    });
  }, [captionEnabled, initialCaptionStyle, initialCaptionPosition, onCaptionStateChange]);

  if (highlights.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-12 h-12 rounded-xl bg-[#f5f5f7] border border-[#d2d2d7] flex items-center justify-center mb-4">
          <svg className="w-6 h-6 text-[#86868b]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z"
            />
          </svg>
        </div>
        <p className="text-sm text-[#86868b]">No highlights detected</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {clipCards.map((card) => (
        <HighlightCard
          key={card.index}
          index={card.index}
          rank={card.rank}
          delay={card.delay}
          clipSrc={card.clipSrc}
          aspectRatio={aspectRatio}
          score={card.score}
          onEdit={() => {
            router.push({
              pathname: "/editor",
              query: {
                job_id,
                clip: card.index,
                aspect: aspectRatio,
                cap: String(card.settings.caption_enabled),
                style: card.settings.caption_style,
                pos: card.settings.caption_position,
                fs: String(card.settings.caption_font_scale),
              },
            });
          }}
        />
      ))}
    </div>
  );
}

