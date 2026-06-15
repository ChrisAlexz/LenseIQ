import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { motion, AnimatePresence } from "framer-motion";
import GridBackground from "../components/GridBackground";
import HighlightPlayer from "../components/HighlightPlayer";
import { useAuth } from "../lib/AuthContext";
import { getToken } from "../services/auth";
import { generateHashtags } from "../lib/hashtagUtils";
import {
  usePlan, useQuota, getDailyLimit
} from "../lib/planUtils";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

function getPipelineApiBase() {
  return "";
}

const PLAN_UI = {
  free: {
    pill: "bg-[#f5f5f7] text-[#86868b] border border-[#d2d2d7]",
    banner: "border-[#e5e5ea] bg-white/80",
    cta: "Generate Reel",
  },
  pro: {
    pill: "bg-gradient-to-r from-amber-400 via-orange-400 to-yellow-300 text-[#2b1900] border border-amber-200 shadow-[0_10px_24px_rgba(245,158,11,0.22)]",
    banner: "border-amber-200 bg-[linear-gradient(135deg,rgba(255,251,235,0.96),rgba(255,255,255,0.96),rgba(255,247,237,0.96))] shadow-[0_16px_40px_rgba(245,158,11,0.14)]",
    cta: "Generate Pro Reel",
  },
};

/* ── Neural Network Background ── */
function NeuralNetwork() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    // Particles — grid-based placement with jitter for even distribution
    const PARTICLE_COUNT = 160;
    const CONNECTION_DIST = 120;
    const particles = [];
    const cols = Math.round(Math.sqrt(PARTICLE_COUNT * (canvas.width / canvas.height)));
    const rows = Math.round(PARTICLE_COUNT / cols);
    const cellW = canvas.width / cols;
    const cellH = canvas.height / rows;
    let idx = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols && idx < PARTICLE_COUNT; c++, idx++) {
        const isGreen = idx < PARTICLE_COUNT * 0.25;
        particles.push({
          x: (c + 0.5) * cellW + (Math.random() - 0.5) * cellW * 0.7,
          y: (r + 0.5) * cellH + (Math.random() - 0.5) * cellH * 0.7,
          vx: (Math.random() - 0.5) * 0.5,
          vy: (Math.random() - 0.5) * 0.5,
          green: isGreen,
          r: isGreen ? Math.random() * 2.5 + 1 : Math.random() * 1 + 1,
          pulse: Math.random() * Math.PI * 2,
        });
      }
    }

    // Signals
    const signals = [];
    let frame = 0;
    let raf;

    const greenIndices = particles.map((p, i) => p.green ? i : -1).filter((i) => i >= 0);

    const loop = () => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);
      frame++;

      // Move particles
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;
        p.x = Math.max(0, Math.min(w, p.x));
        p.y = Math.max(0, Math.min(h, p.y));
        p.pulse += 0.03;
      }

      // Draw connections
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const a = particles[i];
          const b = particles[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist >= CONNECTION_DIST) continue;

          const opacity = 1 - dist / CONNECTION_DIST;

          if (a.green && b.green) {
            ctx.strokeStyle = `rgba(59,130,246,${opacity * 0.7})`;
            ctx.lineWidth = 1;
          } else if (a.green || b.green) {
            ctx.strokeStyle = `rgba(59,130,246,${opacity * 0.25})`;
            ctx.lineWidth = 0.5;
          } else {
            ctx.strokeStyle = `rgba(255,255,255,${opacity * 0.06})`;
            ctx.lineWidth = 0.5;
          }

          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }

      // Spawn signals every 60 frames
      if (frame % 60 === 0 && greenIndices.length >= 2) {
        const idxA = greenIndices[Math.floor(Math.random() * greenIndices.length)];
        let idxB = idxA;
        while (idxB === idxA) idxB = greenIndices[Math.floor(Math.random() * greenIndices.length)];
        signals.push({ a: idxA, b: idxB, t: 0, speed: 1 / (90 + Math.random() * 30) });
      }

      // Draw signals
      for (let i = signals.length - 1; i >= 0; i--) {
        const s = signals[i];
        s.t += s.speed;
        if (s.t >= 1) { signals.splice(i, 1); continue; }

        const a = particles[s.a];
        const b = particles[s.b];
        const px = a.x + (b.x - a.x) * s.t;
        const py = a.y + (b.y - a.y) * s.t;
        const alpha = Math.sin(s.t * Math.PI);

        // Outer glow
        const grad = ctx.createRadialGradient(px, py, 0, px, py, 6);
        grad.addColorStop(0, `rgba(59,130,246,${alpha * 0.7})`);
        grad.addColorStop(1, "rgba(59,130,246,0)");
        ctx.beginPath();
        ctx.arc(px, py, 6, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();

        // Core
        ctx.beginPath();
        ctx.arc(px, py, 3, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(59,130,246,${alpha})`;
        ctx.fill();
      }

      // Draw particles
      for (const p of particles) {
        const glow = 0.5 + 0.5 * Math.sin(p.pulse);
        if (p.green) {
          const alpha = 0.5 + glow * 0.5;
          // Halo
          const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 4);
          grad.addColorStop(0, `rgba(59,130,246,${alpha * 0.3})`);
          grad.addColorStop(1, "rgba(59,130,246,0)");
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r * 4, 0, Math.PI * 2);
          ctx.fillStyle = grad;
          ctx.fill();
          // Core
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(59,130,246,${alpha})`;
          ctx.fill();
        } else {
          const alpha = 0.2 + glow * 0.2;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255,255,255,${alpha})`;
          ctx.fill();
        }
      }

      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1.5 }}
      className="absolute inset-0 pointer-events-none overflow-hidden"
    >
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
    </motion.div>
  );
}
const RESULT_CACHE_TTL_MS = 5 * 60 * 1000;
const DASHBOARD_CACHE_PREFIX = "dashboard_results_v1";

const SPORTS = [
  { value: "soccer",     label: "Soccer" },
  { value: "football",   label: "Football" },
  { value: "basketball", label: "Basketball" },
  { value: "boxing",     label: "Boxing" },
  { value: "tennis",     label: "Tennis" },
  { value: "cricket",     label: "Cricket" },
];

const CAPTION_COLORS = [
  { value: "#ffffff", label: "White" },
  { value: "#faff33", label: "Yellow" },
  { value: "#66ff9b", label: "Green" },
  { value: "#ff5e87", label: "Pink" },
  { value: "#5eb8ff", label: "Blue" },
];

const CAPTION_STYLES = [
  { value: "clean_modern",  label: "Default", font: "Arial, sans-serif" },
  { value: "typewriter",    label: "Mono",    font: "'Courier New', monospace" },
  { value: "classic_serif", label: "Serif",   font: "Georgia, serif" },
  { value: "bold_impact",   label: "Bold",    font: "Impact, sans-serif" },
  { value: "neon_pop",      label: "Casual",  font: "cursive" },
];

const CAPTION_POSITIONS = [
  { value: "top",    label: "Top" },
  { value: "middle", label: "Middle" },
  { value: "bottom", label: "Bottom" },
];

const ASPECT_RATIOS = [
  { value: "9:16", label: "9:16", helper: "Vertical reels" },
  { value: "16:9", label: "16:9", helper: "Landscape video" },
];

const PREVIEW_TEXT = "YOUR CAPTION";

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

function getPreviewContainerClass(aspectRatio) {
  return aspectRatio === "16:9" ? "aspect-video" : "aspect-[9/16]";
}

function getCaptionPlacement(position) {
  if (position === "top") {
    return { top: "10%", transform: "translate(-50%, 0)" };
  }
  if (position === "bottom") {
    return { bottom: "10%", transform: "translate(-50%, 0)" };
  }
  return { top: "50%", transform: "translate(-50%, -50%)" };
}

function CaptionPreview({ imageSrc, aspectRatio, captionStyle, captionPosition, captionEnabled = true, compact = false }) {
  const previewStyle = CAPTION_PREVIEW_STYLE[captionStyle] || CAPTION_PREVIEW_STYLE.bold_impact;
  const placement = getCaptionPlacement(captionPosition);
  const frameStyle = compact
    ? aspectRatio === "16:9"
      ? { width: "100%", maxWidth: "860px", margin: "0 auto", aspectRatio: "16 / 9" }
      : { width: "min(100%, 320px)", maxHeight: "70vh", margin: "0 auto", aspectRatio: "9 / 16" }
    : undefined;

  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-[#e5e5ea] shadow-[0_2px_12px_rgba(15,23,42,0.04)] p-4">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-[#86868b] mb-1">Preview</p>
          <p className="text-xs text-[#86868b]">
            {captionEnabled ? "One extracted frame with your current caption layout." : "One extracted frame without captions."}
          </p>
        </div>
        <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-blue-50 text-blue-600 border border-blue-200">
          {aspectRatio}
        </span>
      </div>

      <div
        className={`relative overflow-hidden rounded-2xl bg-[#f5f5f7] border border-[#d2d2d7] ${compact ? "" : getPreviewContainerClass(aspectRatio)}`}
        style={frameStyle}
      >
        {imageSrc ? (
          <img src={imageSrc} alt="Caption preview frame" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-xs text-[#86868b] px-6 text-center">
            Select a video to generate a frame preview.
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-black/15 pointer-events-none" />

        {imageSrc && captionEnabled && (
          <div
            className="absolute left-1/2 w-[82%] text-center uppercase pointer-events-none"
            style={placement}
          >
            <div
              style={previewStyle}
              className={`inline-block max-w-full text-balance leading-[0.92] ${aspectRatio === "16:9" ? "text-[clamp(24px,3.2vw,46px)]" : "text-[clamp(24px,4.2vw,54px)]"}`}
            >
              {PREVIEW_TEXT}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PreviewModal({ open, onClose, imageSrc, aspectRatio, captionStyle, captionPosition, captionEnabled }) {
  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-sm px-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.98 }}
          transition={{ duration: 0.2 }}
          className="w-full max-w-4xl max-h-[90vh] bg-white rounded-3xl border border-[#d2d2d7] shadow-2xl overflow-hidden flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#e5e5ea]">
            <div>
              <p className="text-sm font-semibold text-[#1d1d1f]">Preview</p>
              <p className="text-xs text-[#86868b]">Check the frame layout before generating.</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-[#f5f5f7] border border-[#d2d2d7] text-[#86868b] hover:text-[#1d1d1f] hover:bg-[#e8e8ed] transition"
            >
              ✕
            </button>
          </div>

          <div className="p-5 overflow-y-auto">
            <CaptionPreview
              imageSrc={imageSrc}
              aspectRatio={aspectRatio}
              captionStyle={captionStyle}
              captionPosition={captionPosition}
              captionEnabled={captionEnabled}
              compact
            />
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

const STEPS = [
  { key: "audio",      label: "Watching your footage" },
  { key: "transcript", label: "Scouting the highlights" },
  { key: "spikes",     label: "Picking the best moments" },
  { key: "highlights", label: "Building your reels" },
];

function Dropdown({ label, options, value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="flex-1 min-w-0">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-[#86868b] mb-2">
        {label}
      </p>
      <div className="relative" ref={ref}>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
            value
              ? "bg-blue-50 text-blue-600 border border-blue-200"
              : "bg-[#f5f5f7] text-[#86868b] border border-[#d2d2d7]"
          }`}
        >
          <span
            className="truncate"
            style={selected?.font ? { fontFamily: selected.font } : {}}
          >
            {selected ? selected.label : "Select..."}
          </span>
          <svg
            className={`w-4 h-4 ml-1 shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M4 6l4 4 4-4" />
          </svg>
        </button>

        {open && (
          <div className="absolute top-[calc(100%+4px)] left-0 right-0 z-10 bg-white border border-[#d2d2d7] shadow-lg rounded-lg overflow-hidden">
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                style={option.font ? { fontFamily: option.font } : {}}
                className={`w-full flex items-center justify-between px-3 py-2.5 text-sm text-left transition-colors duration-150 ${
                  value === option.value
                    ? "text-blue-600"
                    : "text-[#86868b] hover:text-[#1d1d1f] hover:bg-[#f5f5f7]"
                }`}
              >
                {option.label}
                {value === option.value && (
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block shrink-0" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const router = useRouter();
  const { user, isLoading, refreshSession } = useAuth();
  const cacheKey = user?.user_id ? `${DASHBOARD_CACHE_PREFIX}:${user.user_id}` : null;

  useEffect(() => {
    if (!isLoading && user === null) router.replace("/login");
  }, [isLoading, user, router]);

  const [view, setView]                       = useState("upload");
  const plan                                  = usePlan(user);
  const planUi                                = PLAN_UI[plan] || PLAN_UI.free;
  const used                                  = useQuota(user);
  const dailyLimit                            = getDailyLimit(plan);
  const quotaExceeded                         = used >= dailyLimit;
  const [topic, setTopic]                     = useState("");
  const [captionColor, setCaptionColor]       = useState("#ffffff");
  const [captionEdits, setCaptionEdits]       = useState({});
  const [sport, setSport]                     = useState("soccer");
  const [captionEnabled, setCaptionEnabled]   = useState(true);
  const [captionStyle, setCaptionStyle]       = useState("bold_impact");
  const [captionPosition, setCaptionPosition] = useState("middle");
  const [aspectRatio, setAspectRatio]         = useState("9:16");
  const [status, setStatus]                   = useState("");
  const [completedSteps, setCompletedSteps]   = useState({});
  const [highlights, setHighlights]           = useState([]);
  const [usedCaptions, setUsedCaptions]       = useState(true);
  const [usedPlan, setUsedPlan]               = useState("free");
  const [usedAspectRatio, setUsedAspectRatio] = useState("9:16");
  const [usedSport, setUsedSport]             = useState("soccer");
  const [usedTopic, setUsedTopic]             = useState("");
  const [hashtags, setHashtags]               = useState("");
  const [jobId, setJobId]                     = useState(null);
  const [error, setError]                     = useState(null);
  const [fileName, setFileName]               = useState("");
  const [formError, setFormError]             = useState("");
  const [dragOver, setDragOver]               = useState(false);
  const [previewImage, setPreviewImage]       = useState("");
  const [previewOpen, setPreviewOpen]         = useState(false);
  const fileRef = useRef(null);
  const pipelineApiBase = getPipelineApiBase();

  useEffect(() => {
    if (isLoading || !user || !cacheKey || typeof window === "undefined") return;

    const raw = window.localStorage.getItem(cacheKey);
    if (!raw) return;

    try {
      const cached = JSON.parse(raw);
      if (!cached?.expiresAt || cached.expiresAt < Date.now()) {
        window.localStorage.removeItem(cacheKey);
        return;
      }

      setView(cached.view || "results");
      setHighlights(cached.highlights || []);
      setUsedCaptions(Boolean(cached.usedCaptions));
      setUsedPlan(cached.usedPlan || "free");
      setUsedAspectRatio(cached.usedAspectRatio || "9:16");
      setUsedSport(cached.usedSport || "soccer");
      setUsedTopic(cached.usedTopic || "");
      setHashtags(cached.hashtags || "");
      setJobId(cached.jobId || null);
      setCompletedSteps(cached.completedSteps || { audio: true, transcript: true, spikes: true, highlights: true });
      setStatus(cached.status || "complete");
      setError(null);
    } catch {
      window.localStorage.removeItem(cacheKey);
    }
  }, [cacheKey, isLoading, user]);

  function persistDashboardResult(nextState) {
    if (!cacheKey || typeof window === "undefined") return;

    window.localStorage.setItem(
      cacheKey,
      JSON.stringify({
        ...nextState,
        expiresAt: Date.now() + RESULT_CACHE_TTL_MS,
      })
    );
  }

  function clearDashboardResult() {
    if (!cacheKey || typeof window === "undefined") return;
    window.localStorage.removeItem(cacheKey);
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    setFileName(file ? file.name : "");
    if (formError) setFormError("");
    if (file) {
      generatePreviewFrame(file);
    } else {
      setPreviewImage("");
    }
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer?.files?.[0];
    if (file && file.type.startsWith("video/")) {
      const dt = new DataTransfer();
      dt.items.add(file);
      fileRef.current.files = dt.files;
      setFileName(file.name);
      if (formError) setFormError("");
      generatePreviewFrame(file);
    }
  }

  function generatePreviewFrame(file) {
    const objectUrl = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    video.src = objectUrl;

    const cleanup = () => {
      URL.revokeObjectURL(objectUrl);
      video.removeAttribute("src");
      video.load();
    };

    const captureFrame = () => {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        cleanup();
        return;
      }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      setPreviewImage(canvas.toDataURL("image/jpeg", 0.85));
      cleanup();
    };

    video.onloadedmetadata = () => {
      const frameTime = Number.isFinite(video.duration) && video.duration > 1 ? Math.min(1, video.duration / 3) : 0;
      if (frameTime > 0) {
        video.currentTime = frameTime;
      } else {
        captureFrame();
      }
    };

    video.onseeked = captureFrame;
    video.onloadeddata = () => {
      if (!(Number.isFinite(video.duration) && video.duration > 1)) {
        captureFrame();
      }
    };
    video.onerror = cleanup;
  }

  async function handleProcess() {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setFormError("Please select a video file first.");
      return;
    }
    if (quotaExceeded) {
      setFormError(`Daily limit reached (${dailyLimit}/${dailyLimit}). ${plan === "free" ? "Upgrade to Pro for more." : "Try again tomorrow."}`);
      return;
    }
    clearDashboardResult();
    setFormError("");
    setView("processing");
    setError(null);
    setStatus("uploading");
    setCompletedSteps({});
    setHighlights([]);

    try {
      const form = new FormData();
      form.append("file", file);
      form.append("sport", sport);
      form.append("plan", plan);
      form.append("reel_type", "short");
      form.append("caption_enabled", String(captionEnabled));
      form.append("caption_style", captionStyle);
      form.append("caption_position", captionPosition);
      form.append("aspect_ratio", aspectRatio);
      if (plan === "pro") {
        form.append("topic", topic);
        form.append("caption_color", captionColor);
        form.append("no_watermark", "true");
      }

      const uploadRes = await fetch(`${pipelineApiBase}/api/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}` },
        body: form,
      });
      if (!uploadRes.ok) throw new Error("Upload failed");
      const { job_id, job_dir } = await uploadRes.json();
      setJobId(job_dir || job_id);

      setStatus("processing");
      const processRes = await fetch(`${pipelineApiBase}/api/process/${job_id}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!processRes.ok) {
        const err = await processRes.json();
        throw new Error(err.detail || "Processing failed");
      }
      const processData = await processRes.json();
      if (processData.job_dir) setJobId(processData.job_dir);

      let result = null;
      while (true) {
        await new Promise((r) => setTimeout(r, 3001));

        const statusRes = await fetch(`${pipelineApiBase}/api/status/${job_id}`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        });
        if (!statusRes.ok) throw new Error("Failed to get status");

        const statusData = await statusRes.json();
        setCompletedSteps(statusData.steps || {});
        if (statusData.job_dir) setJobId(statusData.job_dir);

        if (statusData.status === "complete") {
          result = statusData;
          break;
        }
        if (statusData.status === "error") {
          throw new Error(statusData.error || "Pipeline failed");
        }
      }

      setCompletedSteps({ audio: true, transcript: true, spikes: true, highlights: true });
      const resultHighlights = result.highlights || [];
      const resultPlan = result.plan || plan;
      setHighlights(resultHighlights);
      setUsedPlan(resultPlan);
      setUsedCaptions(Boolean(result.caption_enabled ?? captionEnabled));
      setUsedAspectRatio(result.aspect_ratio || aspectRatio);
      setUsedSport(resultPlan === "pro" ? "general" : sport);
      setUsedTopic(resultPlan === "pro" ? topic.trim() : "");

      let nextTags;
      if (resultPlan === "pro") {
        try {
          const token = getToken();
          const tagRes = await fetch(`${pipelineApiBase}/api/generate-hashtags`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({
              sport: resultPlan === "pro" ? "general" : sport,
              topic: topic.trim(),
              highlights: resultHighlights,
            }),
          });
          if (tagRes.ok) {
            const tagData = await tagRes.json();
            nextTags = (tagData.hashtags || []).join(" ");
          } else {
            const errorBody = await tagRes.json().catch(() => ({}));
            throw new Error(errorBody.detail || "AI hashtag generation failed");
          }
        } catch (tagError) {
          console.error("Pro hashtag generation failed:", tagError);
          nextTags = "#LENSEIQ";
        }
      } else {
        nextTags = generateHashtags(sport);
      }

      setHashtags(nextTags);
      setStatus("complete");
      setView("results");
      await refreshSession();   // re-fetch uploads_today from DB
      persistDashboardResult({
        view: "results",
        highlights: resultHighlights,
        usedPlan: resultPlan,
        usedCaptions: Boolean(result.caption_enabled ?? captionEnabled),
        usedAspectRatio: result.aspect_ratio || aspectRatio,
        usedSport: resultPlan === "pro" ? "general" : sport,
        usedTopic: resultPlan === "pro" ? topic.trim() : "",
        hashtags: nextTags,
        jobId: result.job_dir || jobId,
        completedSteps: { audio: true, transcript: true, spikes: true, highlights: true },
        status: "complete",
      });

    } catch (e) {
      setError(e.message || "Something went wrong");
      setStatus("error");
    }
  }

  function reset() {
    clearDashboardResult();
    setView("upload");
    setError(null);
    setFileName("");
    setCompletedSteps({});
    setHighlights([]);
    setJobId(null);
    setStatus("");
    setUsedPlan("free");
    setCaptionEdits({});
    setUsedSport("soccer");
    setUsedTopic("");
    setHashtags("");
    setDragOver(false);
    setPreviewImage("");
    setPreviewOpen(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  if (isLoading || !user) return null;
  const displayName = user?.name || user?.email?.split("@")[0] || "";
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <GridBackground subtle>
      <div className="min-h-screen flex flex-col">
        {/* ── Header ── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
          className="pt-32 pb-3 px-6 sm:px-10"
        >
          <div className="max-w-7xl mx-auto flex items-end justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold text-[#1d1d1f] tracking-tight flex items-center gap-2">
                <span>{greeting}{displayName ? `, ${displayName}` : ""}</span>
                {plan === "pro" && <span className="text-[0.8em]" aria-label="Pro user">👑</span>}
              </h1>
              <p className="text-sm text-[#86868b] mt-2">
                {view === "upload"
                  ? "Upload a video and we'll find the best moments for you."
                  : view === "processing"
                  ? "Sit tight — your reel is being crafted."
                  : "Here are your highlights, ready to share."}
              </p>
            </div>
            {view !== "upload" && (
              <button
                onClick={reset}
                className="text-sm font-medium text-[#424245] hover:text-[#1d1d1f] transition px-4 py-2 rounded-xl bg-white/70 backdrop-blur border border-[#d2d2d7]/70 hover:bg-white shadow-sm"
              >
                ← Back
              </button>
            )}
          </div>
        </motion.div>

        {/* ── Content ── */}
        <div className="flex-1 px-6 sm:px-10 pb-6">
          <div className="max-w-7xl mx-auto">
            <AnimatePresence mode="wait">

              {/* ═══════ UPLOAD ═══════ */}
              {view === "upload" && (
                <motion.div
                  key="upload"
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
                >
                  <div className="grid grid-cols-1 xl:grid-cols-[1.35fr_1fr] gap-6 items-stretch">
                  {/* Drop zone */}
                  <div
                    onClick={() => fileRef.current?.click()}
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleDrop}
                    className={`relative group cursor-pointer rounded-3xl border-2 border-dashed transition-all duration-300 overflow-hidden min-h-[260px] xl:min-h-[460px] shadow-sm ${
                      formError
                        ? "border-red-400/60 bg-red-50/60"
                        : fileName
                        ? "border-blue-500/60 bg-gradient-to-br from-blue-50/80 to-white"
                        : dragOver
                        ? "border-blue-500/70 bg-gradient-to-br from-blue-50 to-white scale-[1.005] shadow-lg shadow-blue-600/10"
                        : "border-[#d2d2d7] bg-gradient-to-br from-white to-[#fafafa] hover:border-blue-400/60 hover:shadow-md"
                    }`}
                  >
                    <input ref={fileRef} type="file" accept="video/*" className="hidden" onChange={handleFileChange} />

                    <div className="flex h-full flex-col items-center justify-center px-6 py-10">
                      {fileName ? (
                        <motion.div
                          initial={{ scale: 0.95, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
                          className="w-full max-w-md rounded-2xl border border-blue-200 bg-white/90 px-5 py-6 text-center shadow-sm"
                        >
                          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-100 text-blue-600">
                            <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6.75a3.75 3.75 0 10-7.5 0v10.5a3 3 0 006 0V9.75a1.5 1.5 0 10-3 0v6.75" />
                            </svg>
                          </div>
                          <p className="mb-2 text-sm font-semibold text-[#1d1d1f]">Video selected</p>
                          <p className="truncate text-sm text-[#424245]">{fileName}</p>
                          <p className="mt-3 text-xs text-[#86868b]">Click here to choose a different file.</p>
                        </motion.div>
                      ) : (
                        <>
                          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-50 to-blue-100/50 border border-blue-200/60 flex items-center justify-center mb-5 group-hover:scale-105 group-hover:shadow-md group-hover:shadow-blue-600/10 transition-all duration-300">
                            <svg className="w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                            </svg>
                          </div>
                          <p className="text-base font-semibold text-[#1d1d1f] mb-1.5">Drop your video to begin</p>
                          <p className="text-xs text-[#86868b]">or click anywhere to browse</p>
                          <div className="mt-5 flex items-center gap-2">
                            {["MP4", "MOV", "AVI"].map((f) => (
                              <span key={f} className="text-[10px] font-semibold px-2 py-1 rounded-md bg-white border border-[#e5e5ea] text-[#86868b]">{f}</span>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                    {formError && (
                      <div className="absolute bottom-0 inset-x-0 bg-red-500/10 border-t border-red-500/20 px-4 py-2 text-center">
                        <p className="text-xs text-red-400">{formError}</p>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-3">

                    {/* Plan + quota banner */}
                    <div className={`rounded-2xl border p-4 backdrop-blur-sm shadow-[0_2px_12px_rgba(15,23,42,0.04)] ${planUi.banner}`}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full ${planUi.pill}`}>
                            {plan}
                          </span>
                          <span className="text-xs text-[#424245]">
                            {used} / {dailyLimit} videos used today
                          </span>
                        </div>
                        {plan === "free" ? (
                          <Link href="/pro" className="text-xs font-semibold text-blue-600 hover:text-blue-500">Upgrade</Link>
                        ) : (
                          <span className="text-xs font-semibold tracking-[0.18em] uppercase text-amber-700">Premium</span>
                        )}
                      </div>
                    </div>

                    {/* Sport */}
                    <div className={`backdrop-blur-sm rounded-2xl border shadow-[0_2px_12px_rgba(15,23,42,0.04)] p-4 ${plan === "pro" ? "bg-[linear-gradient(135deg,rgba(255,251,235,0.95),rgba(255,255,255,0.98),rgba(255,247,237,0.95))] border-amber-200" : "bg-white/80 border-[#e5e5ea]"}`}>
                      <p className="text-xs font-semibold uppercase tracking-widest text-[#86868b] mb-2">
                        {plan === "free" ? "Sport" : "Content Type"}
                      </p>
                      {plan === "free" ? (
                        <div className="grid grid-cols-2 gap-2">
                          {SPORTS.map((s) => (
                            <button
                              key={s.value}
                              type="button"
                              onClick={() => setSport(s.value)}
                              className={`px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                                sport === s.value
                                  ? "bg-blue-600 text-white"
                                  : "bg-[#f5f5f7] text-[#86868b] hover:text-[#1d1d1f] hover:bg-[#e8e8ed] border border-[#d2d2d7] hover:border-[#86868b]"
                              }`}
                            >
                              {s.label}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div>
                          <input
                            type="text"
                            value={topic}
                            onChange={(e) => setTopic(e.target.value)}
                            placeholder="e.g. funny cat moments, debate highlights, esports clutches…"
                            className="w-full px-3 py-2.5 rounded-lg bg-white border border-[#d2d2d7] text-sm text-[#1d1d1f] placeholder:text-[#86868b] focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition"
                          />
                          <p className="mt-2 text-xs text-[#86868b]">
                            Describe what you want clipped.
                          </p>
                        </div>
                      )}
                    </div>

                    <div className={`backdrop-blur-sm rounded-2xl border shadow-[0_2px_12px_rgba(15,23,42,0.04)] p-4 ${plan === "pro" ? "bg-[linear-gradient(135deg,rgba(255,251,235,0.95),rgba(255,255,255,0.98))] border-amber-200" : "bg-white/80 border-[#e5e5ea]"}`}>
                      <p className="text-xs font-semibold uppercase tracking-widest text-[#86868b] mb-2">Resolution</p>
                      <div className="grid grid-cols-2 gap-2">
                        {ASPECT_RATIOS.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => setAspectRatio(option.value)}
                            className={`px-3 py-3 rounded-lg text-left transition-all duration-200 border ${
                              aspectRatio === option.value
                                ? "bg-blue-600 text-white border-blue-600"
                                : "bg-[#f5f5f7] text-[#86868b] border-[#d2d2d7] hover:text-[#1d1d1f] hover:bg-[#e8e8ed] hover:border-[#86868b]"
                            }`}
                          >
                            <span className="block text-sm font-semibold">{option.label}</span>
                            <span className={`block text-xs mt-1 ${aspectRatio === option.value ? "text-blue-100" : "text-[#86868b]"}`}>
                              {option.helper}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Captions */}
                    <div className={`backdrop-blur-sm rounded-2xl border shadow-[0_2px_12px_rgba(15,23,42,0.04)] p-4 ${plan === "pro" ? "bg-[linear-gradient(135deg,rgba(255,251,235,0.95),rgba(255,255,255,0.98),rgba(255,247,237,0.92))] border-amber-200" : "bg-white/80 border-[#e5e5ea]"}`}>
                      <p className="text-xs font-semibold uppercase tracking-widest text-[#86868b] mb-2">Captions</p>

                      <div className="grid grid-cols-2 gap-2 mb-4">
                        <button
                          type="button"
                          onClick={() => setCaptionEnabled(true)}
                          className={`px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                            captionEnabled
                              ? "bg-blue-600 text-white"
                              : "bg-[#f5f5f7] text-[#86868b] hover:text-[#1d1d1f] hover:bg-[#e8e8ed] border border-[#d2d2d7] hover:border-[#86868b]"
                          }`}
                        >
                          Add Captions
                        </button>
                        <button
                          type="button"
                          onClick={() => setCaptionEnabled(false)}
                          className={`px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                            !captionEnabled
                              ? "bg-blue-600 text-white"
                              : "bg-[#f5f5f7] text-[#86868b] hover:text-[#1d1d1f] hover:bg-[#e8e8ed] border border-[#d2d2d7] hover:border-[#86868b]"
                          }`}
                        >
                          No Captions
                        </button>
                      </div>

                      {plan === "pro" && captionEnabled ? (
                        <div className="space-y-3 mt-3 pt-3 border-t border-[#e5e5ea]">
                          <Dropdown label="Style" options={CAPTION_STYLES} value={captionStyle} onChange={setCaptionStyle} />
                          <Dropdown label="Position" options={CAPTION_POSITIONS} value={captionPosition} onChange={setCaptionPosition} />
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-widest text-[#86868b] mb-2">Color</p>
                            <div className="flex items-center gap-2 flex-wrap">
                              {CAPTION_COLORS.map((c) => (
                                <button
                                  key={c.value}
                                  type="button"
                                  onClick={() => setCaptionColor(c.value)}
                                  title={c.label}
                                  className={`w-7 h-7 rounded-full border-2 transition ${captionColor === c.value ? "border-blue-600 scale-110" : "border-[#d2d2d7] hover:border-[#86868b]"}`}
                                  style={{ backgroundColor: c.value }}
                                />
                              ))}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-[#86868b] mt-1">
                          {plan === "pro"
                            ? "Captions are off."
                            : "Upgrade to Pro to customize style, position, and color."}
                        </p>
                      )}
                    </div>

                    <motion.button
                      onClick={handleProcess}
                      disabled={quotaExceeded}
                      whileHover={quotaExceeded ? {} : { scale: 1.01, y: -1 }}
                      whileTap={quotaExceeded ? {} : { scale: 0.98 }}
                      className={`w-full py-3 rounded-2xl text-sm font-bold tracking-wide transition-all duration-200 flex items-center justify-center gap-2 ${
                        quotaExceeded
                          ? "bg-[#e8e8ed] text-[#86868b] cursor-not-allowed"
                          : "bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white shadow-xl shadow-blue-600/25 hover:shadow-2xl hover:shadow-blue-600/35"
                      }`}
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 3l14 9-14 9V3z" />
                      </svg>
                      {quotaExceeded ? `Daily limit reached (${used}/${dailyLimit})` : planUi.cta}
                    </motion.button>
                  </div>
                  </div>
                </motion.div>
              )}

              {/* ═══════ PROCESSING ═══════ */}
              {view === "processing" && (
                <motion.div
                  key="processing"
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.4 }}
                  className="relative flex items-center justify-center min-h-[60vh]"
                >
                  {/* ── Neural network canvas ── */}
                  <NeuralNetwork />

                  <div className="relative z-10 w-full max-w-md">
                    <div className="bg-white rounded-2xl border border-[#d2d2d7] shadow-sm p-8 sm:p-10">
                      {error ? (
                        <div className="text-center">
                          <div className="w-14 h-14 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-5">
                            <svg className="w-7 h-7 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                            </svg>
                          </div>
                          <h2 className="text-lg font-bold text-[#1d1d1f] mb-2">Something went wrong</h2>
                          <p className="text-sm text-[#86868b] mb-8">{error}</p>
                          <button onClick={reset} className="w-full py-3 rounded-lg bg-[#e8e8ed] hover:bg-[#d2d2d7] text-[#1d1d1f] text-sm font-medium transition">
                            Try again
                          </button>
                        </div>
                      ) : (
                        <>
                          <h2 className="text-lg font-bold text-[#1d1d1f] mb-1">Analyzing your video</h2>
                          <p className="text-xs text-[#86868b] mb-8">This may take a minute</p>

                          {(() => {
                            const doneCount = STEPS.filter((s) => completedSteps[s.key]).length;
                            const progress = (doneCount / STEPS.length) * 100;
                            const currentStep = STEPS.find((s) => !completedSteps[s.key]);
                            return (
                              <div className="mb-8">
                                <div className="flex items-center justify-between mb-3">
                                  <span className="text-sm text-[#86868b] font-medium">
                                    {currentStep ? currentStep.label : "Finishing up"}...
                                  </span>
                                  <span className="text-xs text-[#86868b] tabular-nums font-mono">{doneCount}/{STEPS.length}</span>
                                </div>
                                <div className="relative h-2 rounded-full bg-[#e8e8ed] overflow-hidden">
                                  <motion.div
                                    className="absolute inset-y-0 left-0 rounded-full bg-blue-500"
                                    initial={{ width: 0 }}
                                    animate={{ width: `${progress}%` }}
                                    transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
                                  />
                                  {progress < 100 && (
                                    <motion.div
                                      className="absolute inset-y-0 left-0 rounded-full bg-blue-400/30"
                                      initial={{ width: 0 }}
                                      animate={{ width: `${Math.min(progress + 12, 100)}%` }}
                                      transition={{ duration: 1.2, ease: "easeInOut", repeat: Infinity, repeatType: "reverse" }}
                                    />
                                  )}
                                </div>
                              </div>
                            );
                          })()}

                          <div className="space-y-1">
                            {STEPS.map((step, i) => {
                              const done = completedSteps[step.key];
                              const isActive = !done && STEPS.findIndex((s) => !completedSteps[s.key]) === i;
                              return (
                                <motion.div
                                  key={step.key}
                                  initial={{ opacity: 0, x: -8 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  transition={{ delay: i * 0.08 }}
                                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-500 ${
                                    done ? "bg-blue-50" : isActive ? "bg-[#f5f5f7]" : ""
                                  }`}
                                >
                                  {done ? (
                                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="w-5 h-5 rounded-full bg-blue-500/15 flex items-center justify-center shrink-0">
                                      <svg className="w-3 h-3 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                      </svg>
                                    </motion.div>
                                  ) : isActive ? (
                                    <div className="w-5 h-5 rounded-full border-2 border-blue-500/40 flex items-center justify-center shrink-0">
                                      <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                                    </div>
                                  ) : (
                                    <div className="w-5 h-5 rounded-full border border-[#d2d2d7] shrink-0" />
                                  )}
                                  <span className={`text-sm transition-colors duration-300 ${
                                    done ? "text-[#424245]" : isActive ? "text-[#1d1d1f]" : "text-[#86868b]"
                                  }`}>{step.label}</span>
                                </motion.div>
                              );
                            })}
                          </div>

                          <button onClick={reset} className="w-full mt-8 py-3 rounded-lg text-[#86868b] hover:text-[#424245] text-sm transition">
                            Cancel
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* ═══════ RESULTS ═══════ */}
              {view === "results" && (
                <motion.div
                  key="results"
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.4 }}
                >
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="bg-gradient-to-r from-blue-50 via-white to-emerald-50/40 border border-[#e5e5ea] rounded-2xl px-6 py-5 mb-8 flex items-center justify-between flex-wrap gap-4 shadow-[0_2px_16px_rgba(15,23,42,0.04)]"
                  >
                    <div className="flex items-center gap-3">
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", stiffness: 400, damping: 15, delay: 0.2 }}
                        className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-md shadow-blue-600/25"
                      >
                        <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </motion.div>
                      <div>
                        <p className="text-base font-semibold text-[#1d1d1f]">Your reel is ready</p>
                        <p className="text-xs text-[#86868b] mt-0.5">
                          {highlights.length} highlight{highlights.length !== 1 ? "s" : ""} detected · {usedPlan} plan · {usedAspectRatio}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={reset}
                      className="px-4 py-2 rounded-lg bg-[#e8e8ed] hover:bg-[#d2d2d7] text-[#86868b] hover:text-[#1d1d1f] text-sm font-medium transition"
                    >
                      New Video
                    </button>
                  </motion.div>

                  <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-4">
                    <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-[#e5e5ea] shadow-[0_2px_12px_rgba(15,23,42,0.04)] p-4 h-fit">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-widest text-[#86868b] mb-1">Hashtags</p>
                          <p className="text-xs text-[#86868b]">
                            {usedPlan === "pro" ? `AI-generated for ${usedTopic || "general content"}` : `Generated for ${usedSport}`}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={async () => {
                            let next;
                            if (usedPlan === "pro") {
                              try {
                                const token = getToken();
                                const tagRes = await fetch(`${pipelineApiBase}/api/generate-hashtags`, {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                                  body: JSON.stringify({
                                    sport: "general",
                                    topic: usedTopic,
                                    highlights,
                                  }),
                                });
                                if (tagRes.ok) {
                                  const tagData = await tagRes.json();
                                  next = (tagData.hashtags || []).join(" ");
                                } else {
                                  const errorBody = await tagRes.json().catch(() => ({}));
                                  throw new Error(errorBody.detail || "AI hashtag regeneration failed");
                                }
                              } catch (tagError) {
                                console.error("Pro hashtag regeneration failed:", tagError);
                                next = "#LENSEIQ";
                              }
                            } else {
                              next = generateHashtags(usedSport);
                            }
                            setHashtags(next);
                            persistDashboardResult({
                              view: "results",
                              highlights,
                              usedPlan,
                              usedCaptions,
                              usedAspectRatio,
                              usedSport,
                              usedTopic,
                              hashtags: next,
                              jobId,
                              completedSteps,
                              status: "complete",
                            });
                          }}
                          className="px-3 py-1.5 rounded-lg bg-[#f5f5f7] border border-[#d2d2d7] text-xs font-semibold text-[#1d1d1f] hover:bg-[#e8e8ed] transition"
                        >
                          Regenerate
                        </button>
                      </div>

                      <div className="rounded-xl bg-[#fafafa] border border-[#e8e8ed] p-3">
                        <p className="text-xs text-[#1d1d1f] whitespace-pre-wrap break-words leading-relaxed">
                          {usedPlan === "pro" ? (hashtags || "#LENSEIQ") : (hashtags || generateHashtags(usedSport))}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={async () => {
                          const text = usedPlan === "pro" ? (hashtags || "#LENSEIQ") : (hashtags || generateHashtags(usedSport));
                          try {
                            await navigator.clipboard.writeText(text);
                          } catch {
                            // ignore
                          }
                        }}
                        className="w-full mt-3 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold tracking-wide transition-colors"
                      >
                        Copy Hashtags
                      </button>

                      
                    </div>

                    <div>
                      <HighlightPlayer highlights={highlights} captionEnabled={usedCaptions} job_id={jobId} aspectRatio={usedAspectRatio} />
                    </div>
                  </div>
                </motion.div>
              )}

            </AnimatePresence>
          </div>
        </div>
      </div>

      <PreviewModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        imageSrc={previewImage}
        aspectRatio={aspectRatio}
        captionStyle={captionStyle}
        captionPosition={captionPosition}
        captionEnabled={captionEnabled}
      />
    </GridBackground>
  );
}
