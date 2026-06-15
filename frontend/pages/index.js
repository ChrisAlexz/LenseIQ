import Link from "next/link";
import React, { useRef, useState, useEffect } from "react";
import { motion, useInView, AnimatePresence } from "framer-motion";
import { Timer, Brain, Clapperboard } from "lucide-react";
import GridBackground from "../components/GridBackground";
import { GlowCard } from "../components/ui/spotlight-card";
import { ContainerScroll } from "../components/ui/container-scroll-animation";
import { LogoIcon } from "../components/Logo";

/* ── scroll reveal ── */
function Reveal({ children, className = "", delay = 0 }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 32 }}
      animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 32 }}
      transition={{ duration: 0.65, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ── data ── */
const FEATURES = [
  {
    title: "Editing in Minutes",
    desc: "Upload footage and get highlights in minutes, not hours.",
    icon: Timer,
  },
  {
    title: "Content Intelligence",
    desc: "Trained for any content.",
    icon: Brain,
  },
  {
    title: "Auto Captions",
    desc: "Captions burned into every clip, ready to post.",
    icon: Clapperboard,
  },
];

const STEPS = [
  { num: "01", title: "Upload", desc: "Drop your raw game footage — any format, any length." },
  { num: "02", title: "Analyze", desc: "AI scans audio spikes, crowd reactions, and key plays." },
  { num: "03", title: "Generate", desc: "Get captioned, export-ready highlight reels instantly." },
];

export default function LandingPage() {
  const [showSplash, setShowSplash] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setShowSplash(false), 1500);
    return () => clearTimeout(t);
  }, []);

  return (
    <>
    <AnimatePresence>
      {showSplash && (
        <motion.div
          key="splash"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, filter: "blur(8px)" }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-white"
        >
          {/* soft ambient gradient */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8 }}
            className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(59,130,246,0.10),transparent_60%)]"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.94, filter: "blur(14px)", y: 8 }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)", y: 0 }}
            exit={{ opacity: 0, scale: 1.04, filter: "blur(10px)", y: -6 }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            className="relative flex flex-col items-center gap-4"
          >
            <div className="flex items-center gap-5">
              <LogoIcon size={84} />
              <span className="text-6xl sm:text-7xl lg:text-8xl font-extrabold tracking-tight bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 bg-clip-text text-transparent">
                LENSEIQ
              </span>
            </div>
            {/* underline sweep */}
            <motion.div
              initial={{ scaleX: 0, opacity: 0 }}
              animate={{ scaleX: 1, opacity: 1 }}
              transition={{ duration: 0.9, delay: 0.35, ease: [0.22, 1, 0.36, 1] }}
              style={{ originX: 0 }}
              className="h-px w-72 bg-gradient-to-r from-transparent via-blue-500/60 to-transparent"
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
    <GridBackground animated>

      {/* ═══════════ HERO ═══════════ */}
      <section className="relative min-h-screen flex items-center overflow-hidden">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8 }}
          className="w-full max-w-7xl mx-auto px-6 lg:px-10 pt-28 pb-20 flex flex-col lg:flex-row items-center gap-12 lg:gap-6"
        >
          {/* ── Left: Copy ── */}
          <div className="flex-1 relative z-10 max-w-xl">
        
              
          

            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35, duration: 0.6 }}
              className="mb-6 leading-[1.08]"
            >
              <span className="text-[2rem] sm:text-6xl lg:text-[5rem] font-extrabold tracking-tight text-[#1d1d1f]">
                Let{" "}
                <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 bg-clip-text text-transparent">
                  LENSEIQ
                </span>
              </span>
              <span className="block text-[2rem] sm:text-6xl lg:text-[5rem] font-extrabold tracking-tight text-[#1d1d1f]">
                Find the highlight.
              </span>
            </motion.div>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.5 }}
              className="text-lg text-[#424245] mb-10 max-w-md"
            >
              Upload your Video. Get Social Media Clips in Minutes.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.65, duration: 0.5 }}
            >
              <Link
                href="/signup"
                className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-all hover:shadow-lg hover:shadow-blue-600/25"
              >
                Try for free →
              </Link>
            </motion.div>
          </div>

          {/* ── Right: Three Phones ── */}
          <motion.div
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45, duration: 0.65, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="flex-1 relative flex items-center justify-center min-h-[420px] sm:min-h-[520px] lg:min-h-[600px] w-full"
          >
            {/* Left phone — Basketball */}
            <div className="phone-float-1 absolute z-10 hidden sm:block" style={{ left: '-6%', top: '12%' }}>
              <div className="phone-tilt-right phone-border-glow rounded-[30px] p-[2px]">
              <div className="phone-frame w-[160px] sm:w-[180px] h-[310px] sm:h-[350px] rounded-[28px] bg-zinc-950 shadow-2xl shadow-white/5 overflow-hidden relative">
                {/* Video background */}
                <video className="absolute inset-0 w-full h-full object-cover" src="/uiclips/doku.mp4" autoPlay loop muted playsInline />
                {/* TikTok UI overlay */}
                <div className="absolute inset-0 flex flex-col justify-end p-3">
                  <p className="text-[9px] font-bold text-white mb-0.5">@ballerAI</p>
                  <p className="text-[8px] text-white/70 mb-2">AI found this #basketball</p>
                  {/* Side icons */}
                  <div className="absolute right-2 bottom-16 flex flex-col items-center gap-3">
                    <div className="flex flex-col items-center">
                      <svg className="w-5 h-5 text-white heart-beat" viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
                      <span className="text-[8px] text-white font-semibold">14k</span>
                    </div>
                    <div className="flex flex-col items-center">
                      <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                      <span className="text-[8px] text-white font-semibold">312</span>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full h-[2px] bg-white/10 rounded-full overflow-hidden mt-1">
                    <div className="h-full bg-blue-400 rounded-full phone-progress" />
                  </div>
                </div>
              </div>
              </div>
            </div>

            {/* Center phone — Soccer (main) */}
            <div className="phone-float-2 relative z-20">
              <div className="phone-tilt-center phone-border-glow-green rounded-[34px] p-[2px]">
              <div className="phone-frame w-[190px] sm:w-[210px] h-[370px] sm:h-[410px] rounded-[32px] bg-zinc-950 shadow-2xl shadow-blue-500/20 overflow-hidden relative">
                {/* Video background */}
                <video className="absolute inset-0 w-full h-full object-cover" src="/uiclips/goal.mp4" autoPlay loop muted playsInline />
                {/* TikTok UI overlay */}
                <div className="absolute inset-0 flex flex-col justify-end p-3.5">
                  <p className="text-[10px] font-bold text-white mb-0.5">@contentclips · <span className="text-blue-400">LENSEIQ</span></p>
                  <p className="text-[8px] text-white/70 mb-2 leading-relaxed">AI caught this screamer 🔥 #space #highlights</p>
                  {/* Side icons */}
                  <div className="absolute right-3 bottom-20 flex flex-col items-center gap-3.5">
                    <div className="flex flex-col items-center">
                      <svg className="w-6 h-6 text-rose-500 heart-beat" viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
                      <span className="text-[9px] text-white font-semibold">48.2k</span>
                    </div>
                    <div className="flex flex-col items-center">
                      <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                      <span className="text-[9px] text-white font-semibold">1.3k</span>
                    </div>
                    <div className="flex flex-col items-center">
                      <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
                      <span className="text-[9px] text-white font-semibold">8.4k</span>
                    </div>
                    {/* Sound wave bars */}
                    <div className="flex items-end gap-[2px] h-4 mt-1">
                      <div className="w-[2px] bg-white/60 rounded-full sound-bar" style={{ animationDelay: '0s' }} />
                      <div className="w-[2px] bg-white/60 rounded-full sound-bar" style={{ animationDelay: '0.15s' }} />
                      <div className="w-[2px] bg-white/60 rounded-full sound-bar" style={{ animationDelay: '0.3s' }} />
                      <div className="w-[2px] bg-white/60 rounded-full sound-bar" style={{ animationDelay: '0.45s' }} />
                    </div>
                  </div>
                  {/* Rising hearts */}
                  <div className="absolute right-3 bottom-44 pointer-events-none">
                    <div className="rising-heart" style={{ animationDelay: '0s' }}>❤️</div>
                    <div className="rising-heart" style={{ animationDelay: '1.2s' }}>❤️</div>
                    <div className="rising-heart" style={{ animationDelay: '2.4s' }}>🧡</div>
                    <div className="rising-heart" style={{ animationDelay: '3.6s' }}>❤️</div>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full h-[2px] bg-white/10 rounded-full overflow-hidden mt-1.5">
                    <div className="h-full bg-blue-400 rounded-full phone-progress" style={{ animationDelay: '0.5s' }} />
                  </div>
                </div>
              </div>
              </div>
            </div>

            {/* Right phone — Basketball */}
            <div className="phone-float-3 absolute z-10 hidden sm:block" style={{ right: '-6%', top: '8%' }}>
              <div className="phone-tilt-left phone-border-glow rounded-[30px] p-[2px]">
              <div className="phone-frame w-[160px] sm:w-[180px] h-[310px] sm:h-[350px] rounded-[28px] bg-zinc-950 shadow-2xl shadow-white/5 overflow-hidden relative">
                {/* Video background */}
                <video className="absolute inset-0 w-full h-full object-cover" src="/uiclips/lamelo.mp4" autoPlay loop muted playsInline />
                {/* TikTok UI overlay */}
                <div className="absolute inset-0 flex flex-col justify-end p-3">
                  <p className="text-[9px] font-bold text-white mb-0.5">@ba</p>
                  <p className="text-[8px] text-white/70 mb-2">Lamelo COOKING</p>
                  {/* Side icons */}
                  <div className="absolute right-2 bottom-16 flex flex-col items-center gap-3">
                    <div className="flex flex-col items-center">
                      <svg className="w-5 h-5 text-white heart-beat" viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
                      <span className="text-[8px] text-white font-semibold">92k</span>
                    </div>
                    <div className="flex flex-col items-center">
                      <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
                      <span className="text-[8px] text-white font-semibold">22k</span>
                    </div>
                  </div>
                  {/* Badge */}

                  {/* Progress bar */}
                  <div className="w-full h-[2px] bg-white/10 rounded-full overflow-hidden mt-1">
                    <div className="h-full bg-blue-400 rounded-full phone-progress" style={{ animationDelay: '1s' }} />
                  </div>
                </div>
              </div>
              </div>
            </div>
          </motion.div>
        </motion.div>

        {/* Accent line */}
        <div
          className="absolute bottom-0 left-0 right-0"
          style={{
            height: '1px',
            opacity: 0.15,
            background: 'linear-gradient(90deg, transparent, #1d1d1f, transparent)',
          }}
        />
      </section>

      {/* ═══════════ FEATURES ═══════════ */}
      <section id="features" className="py-32 px-6 lg:px-10">
        <div className="max-w-5xl mx-auto">
          <Reveal>
            <p className="text-xs font-semibold tracking-widest text-blue-600 uppercase mb-3">Capabilities</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-[#1d1d1f] tracking-tight mb-16">
              Everything you need for highlights
            </h2>
          </Reveal>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {FEATURES.map((f, i) => {
              const Icon = f.icon;
              return (
                <Reveal key={f.title} delay={i * 0.1}>
                  <GlowCard
                    glowColor="green"
                    customSize
                    className="!aspect-auto h-full"
                  >
                    <div className="relative z-10 flex flex-col gap-4 p-3">
                      <div className="w-11 h-11 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                        <Icon className="w-5 h-5 text-blue-600" />
                      </div>
                      <h3 className="text-[15px] font-semibold text-[#1d1d1f]">{f.title}</h3>
                      <p className="text-sm text-[#424245] leading-relaxed">{f.desc}</p>
                    </div>
                  </GlowCard>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══════════ HOW IT WORKS ═══════════ */}
      <section id="workflow">
        <ContainerScroll
          titleComponent={
            <>
              <p className="text-xs font-semibold tracking-widest text-blue-600 uppercase mb-4">Workflow</p>
              <h2 className="text-4xl md:text-[4.5rem] font-bold leading-none tracking-tight">
                <span className="text-[#1d1d1f]">From raw footage to </span>
                <span className="text-blue-600 italic">viral moments</span>
              </h2>
            </>
          }
        >
          {/* Dashboard mockup inside the scroll card */}
          <div className="h-full w-full bg-[#0d0d0f] p-4 md:p-6 flex flex-col">
            {/* Mock top bar */}
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
                  <div className="w-3 h-3 rounded-full bg-[#febc2e]" />
                  <div className="w-3 h-3 rounded-full bg-[#28c840]" />
                </div>
                <div className="ml-3 flex items-center gap-2">
                  <svg width="16" height="16" viewBox="0 0 28 28" fill="none">
                    <circle cx="14" cy="14" r="13" stroke="#2563eb" strokeWidth="1.5" opacity="0.5" />
                    <path d="M11.5 9.5V18.5L19.5 14L11.5 9.5Z" fill="#2563eb" />
                  </svg>
                  <span className="text-xs font-extrabold tracking-tight bg-gradient-to-r from-blue-400 via-indigo-400 to-cyan-300 bg-clip-text text-transparent">
                    LENSEIQ
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-6 px-3 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center">
                  <span className="text-[10px] font-semibold text-blue-400">Dashboard</span>
                </div>
                <div className="h-6 w-6 rounded-full bg-white/[0.06] flex items-center justify-center">
                  <svg className="w-3 h-3 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                  </svg>
                </div>
              </div>
            </div>

            {/* 3-step pipeline */}
            <div className="flex items-center gap-1 mb-5 px-2">
              {STEPS.map((step, i) => (
                <React.Fragment key={step.num}>
                  <div className="flex items-center gap-2.5 flex-1">
                    <div className={`w-7 h-7 md:w-8 md:h-8 rounded-lg flex items-center justify-center text-[10px] md:text-xs font-bold shrink-0 ${
                      i === 2
                        ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                        : "bg-white/[0.04] border border-white/[0.08] text-zinc-500"
                    }`}>
                      {step.num}
                    </div>
                    <div className="hidden sm:block min-w-0">
                      <p className={`text-[11px] font-semibold ${i === 2 ? "text-white" : "text-zinc-500"}`}>{step.title}</p>
                      <p className="text-[9px] text-zinc-600 truncate">{step.desc}</p>
                    </div>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className="w-6 md:w-10 flex items-center justify-center shrink-0">
                      <svg className="w-3 h-3 text-zinc-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 5l7 7-7 7"/></svg>
                    </div>
                  )}
                </React.Fragment>
              ))}
            </div>

            {/* Highlight grid */}
            <div className="flex-1 grid grid-cols-3 gap-2.5 md:gap-3 min-h-0">
              {[
                { label: "FreeKick — 23:14", score: "0.97", img: "/uiclips/preview-1.jpg", tag: "GOAL" },
                { label: "Volley — 41:08", score: "0.91", img: "/uiclips/preview-2.jpg", tag: "SHOT" },
                { label: "TouchDown — 55:32", score: "0.88", img: "/uiclips/preview-3.jpeg", tag: "TD" },
                { label: "HomeRun — 67:45", score: "0.85", img: "/uiclips/preview-4.jpeg", tag: "HR" },
                { label: "Knockout — 72:19", score: "0.79", img: "/uiclips/preview-5.jpg", tag: "KO" },
                { label: "Dunk — 89:01", score: "0.94", img: "/uiclips/preview-6.webp", tag: "DUNK" },
              ].map((clip, i) => (
                <div
                  key={i}
                  className="relative rounded-xl bg-zinc-900/80 border border-white/[0.06] overflow-hidden flex flex-col group hover:border-blue-500/20 transition-colors duration-300"
                >
                  {/* Thumbnail */}
                  <div className="relative flex-1 min-h-0">
                    <img src={clip.img} alt={clip.label} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <div className="w-9 h-9 md:w-11 md:h-11 rounded-full bg-blue-600/90 backdrop-blur-sm flex items-center justify-center shadow-lg shadow-blue-600/30">
                        <svg className="w-3.5 h-3.5 md:w-4 md:h-4 text-white ml-0.5" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </div>
                    </div>
                    {/* Sport tag */}
                    <div className="absolute top-2 left-2">
                      <span className="px-1.5 py-0.5 rounded bg-blue-600/80 text-[8px] font-bold text-white tracking-wide">{clip.tag}</span>
                    </div>
                    {/* Score */}
                    <div className="absolute top-2 right-2">
                      <span className="text-[9px] md:text-[10px] font-bold text-blue-400 bg-black/50 backdrop-blur-sm px-1.5 py-0.5 rounded tabular-nums">{clip.score}</span>
                    </div>
                  </div>
                  {/* Info */}
                  <div className="p-2 md:p-2.5">
                    <span className="text-[10px] md:text-[11px] text-zinc-400 font-medium truncate block">{clip.label}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </ContainerScroll>
      </section>

      {/* ═══════════ CTA ═══════════ */}
      <section className="py-32 px-6 lg:px-10">
        <div className="max-w-2xl mx-auto text-center">
          <Reveal>
            <h2 className="text-4xl sm:text-5xl font-bold text-[#1d1d1f] tracking-tight mb-5">
              Ready to create highlights?
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="text-lg text-[#424245] mb-10 max-w-md mx-auto">
              Start turning your raw game footage into share-ready content. Free to get started.
            </p>
          </Reveal>
          <Reveal delay={0.2}>
            <div className="flex flex-wrap justify-center gap-3">
              <Link
                href="/signup"
                className="px-8 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-all hover:shadow-lg hover:shadow-blue-600/25"
              >
                Get Started Free →
              </Link>
              <Link
                href="/login"
                className="px-8 py-3.5 rounded-xl border border-[#d2d2d7] text-[#424245] hover:text-[#1d1d1f] hover:border-blue-600/40 text-sm font-medium transition-all"
              >
                Log In
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

    </GridBackground>
    </>
  );
}
