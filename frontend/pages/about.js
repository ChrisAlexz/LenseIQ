import React, { useEffect, useRef } from "react";
import { motion, useInView, useScroll, useTransform } from "framer-motion";
import GridBackground from "../components/GridBackground";

function ProblemApproach() {
  const ref = useRef(null);
  const railRef = useRef(null);
  // We keep the rail height in a ref (not state) so scrolling never
  // triggers React re-renders, and the useTransform closure reads the
  // latest value on every frame via railHeightRef.current.
  const railHeightRef = useRef(0);

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 75%", "end 25%"],
  });

  // Transform-only animations: scaleY on the rail (composited), translateY
  // on the dot (composited). The previous implementation animated `height`
  // and `top` — both layout properties — which forced a relayout every
  // scroll frame and caused scroll stutter on this page.
  const lineScaleY = useTransform(scrollYProgress, [0, 1], [0, 1]);
  const dotY = useTransform(scrollYProgress, (v) => v * railHeightRef.current);
  const dotOpacity = useTransform(scrollYProgress, [0, 0.05, 0.95, 1], [0, 1, 1, 0]);

  useEffect(() => {
    const el = railRef.current;
    if (!el) return;
    const update = () => {
      railHeightRef.current = el.offsetHeight;
      // Kick the motion value so the dot snaps to the correct position
      // immediately after measuring, even before the user scrolls.
      scrollYProgress.set(scrollYProgress.get());
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [scrollYProgress]);

  return (
    <section ref={ref} className="py-24 px-6 lg:px-10">
      <div className="max-w-5xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 relative">
          {/* Animated rail — spans the full height of both blocks, anchored to the right column */}
          <div
            ref={railRef}
            className="hidden lg:block absolute left-[calc(33.333%+2rem)] top-2 bottom-2 w-px pointer-events-none"
          >
            <div className="absolute inset-0 bg-[#e5e5ea]" />
            <motion.div
              className="absolute left-0 top-0 w-px h-full bg-gradient-to-b from-blue-500 to-indigo-500"
              style={{
                scaleY: lineScaleY,
                originY: 0,
                willChange: "transform",
              }}
            />
            <motion.div
              className="absolute left-0 top-0 w-3 h-3 rounded-full bg-blue-500 shadow-[0_0_18px_rgba(59,130,246,0.85)]"
              style={{
                y: dotY,
                x: "-50%",
                marginTop: "-6px",
                opacity: dotOpacity,
                willChange: "transform, opacity",
              }}
            />
          </div>

          {/* 01 — Problem */}
          <div className="lg:col-span-4 lg:pt-2">
            <Reveal>
              <p className="text-sm font-medium text-blue-600">01 — The problem</p>
            </Reveal>
          </div>
          <div className="lg:col-span-8 lg:pl-8">
            <Reveal delay={0.1}>
              <h2 className="text-3xl sm:text-4xl font-semibold text-[#1d1d1f] tracking-tight leading-tight mb-6">
                Editing tools assume you have an afternoon. Nobody has an afternoon.
              </h2>
              <p className="text-lg text-[#424245] leading-relaxed">
                Because 'quick edits' don't exist.
              </p>
            </Reveal>
          </div>

          {/* spacer between blocks */}
          <div className="lg:col-span-12 h-20 sm:h-28" />

          {/* 02 — Approach */}
          <div className="lg:col-span-4 lg:pt-2">
            <Reveal>
              <p className="text-sm font-medium text-blue-600">02 — The approach</p>
            </Reveal>
          </div>
          <div className="lg:col-span-8 lg:pl-8">
            <Reveal delay={0.1}>
              <h2 className="text-3xl sm:text-4xl font-semibold text-[#1d1d1f] tracking-tight leading-tight mb-6">
                So we built something that watches the video for you.
              </h2>
              <p className="text-lg text-[#424245] leading-relaxed">
                What you get back is a handful of clips, captioned and ready to send.
                You hit upload, and a few minutes later you have something worth posting.
              </p>
              <CrowdMeter />
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}

function Reveal({ children, className = "", delay = 0 }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 18, filter: "blur(10px)" }}
      animate={
        inView
          ? { opacity: 1, y: 0, filter: "blur(0px)" }
          : { opacity: 0, y: 18, filter: "blur(10px)" }
      }
      transition={{ duration: 0.9, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* Live demo strip — minimal crowd-audio waveform */
function CrowdMeter() {
  const BARS = 40;
  return (
    <div className="mt-8 flex items-center gap-4">
      <p className="text-[11px] font-mono text-[#86868b] shrink-0">listening</p>
      <div className="flex items-center gap-[3px] h-6 flex-1">
        {Array.from({ length: BARS }).map((_, i) => {
          const base = 0.15 + ((i * 37) % 100) / 280;
          const distFromCenter = Math.abs(i - BARS / 2);
          const spike = Math.max(0, 1 - distFromCenter / 7) * 0.65;
          const peak = Math.min(1, base + spike);
          // Bars closer to the center get more blue tint to hint at the spike
          const colorWeight = Math.max(0, 1 - distFromCenter / 8);
          return (
            <motion.div
              key={i}
              className="flex-1 rounded-full"
              style={{
                originY: 1,
                height: "100%",
                background: `rgba(${Math.round(134 - colorWeight * 75)}, ${Math.round(
                  134 - colorWeight * 4
                )}, ${Math.round(139 + colorWeight * 116)}, ${0.45 + colorWeight * 0.45})`,
              }}
              initial={{ scaleY: 0.15 }}
              animate={{ scaleY: [0.15, peak, 0.2, peak * 0.8, 0.25] }}
              transition={{
                duration: 1.8 + (i % 5) * 0.15,
                repeat: Infinity,
                repeatType: "reverse",
                ease: "easeInOut",
                delay: (i % 8) * 0.05,
              }}
            />
          );
        })}
      </div>
      <p className="text-[11px] font-mono text-[#86868b] shrink-0">02:14</p>
    </div>
  );
}

export default function AboutPage() {
  return (
    <GridBackground hue={255}>
      {/* ═══════════ OPENING ═══════════ */}
      <section className="pt-40 pb-16 px-6 lg:px-10">
        <div className="max-w-5xl mx-auto">
          <Reveal>
            <p className="text-sm font-medium text-blue-600 mb-10">About</p>
          </Reveal>

          <Reveal delay={0.05}>
            <h1 className="text-[2.5rem] sm:text-6xl lg:text-7xl font-semibold text-[#1d1d1f] tracking-tight leading-[1.05] max-w-4xl">
              We watch the video so you don't have to.
            </h1>
          </Reveal>

        </div>
      </section>

      {/* ═══════════ THE PROBLEM + APPROACH (with animated rail) ═══════════ */}
      <ProblemApproach />

      {/* ═══════════ NUMBERS (editorial, not dashboard) ═══════════ */}
      <section className="py-24 px-6 lg:px-10">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-y-12 sm:gap-y-0 sm:gap-x-12 border-y border-[#e5e5ea] py-16">
            <Reveal>
              <p className="text-5xl sm:text-6xl font-semibold text-[#1d1d1f] tracking-tight">10×</p>
              <p className="mt-3 text-sm text-[#86868b] max-w-[200px] leading-relaxed">
                roughly how much faster than scrubbing through it yourself
              </p>
            </Reveal>
            <Reveal delay={0.1}>
              <p className="text-5xl sm:text-6xl font-semibold text-[#1d1d1f] tracking-tight">2</p>
              <p className="mt-3 text-sm text-[#86868b] max-w-[200px] leading-relaxed">
                languages supported, with more on the way
              </p>
            </Reveal>
            
            <Reveal delay={0.2}>
              <p className="text-5xl sm:text-6xl font-semibold text-[#1d1d1f] tracking-tight">0</p>
              <p className="mt-3 text-sm text-[#86868b] max-w-[200px] leading-relaxed">
                things you need to install, learn, or pay for to start
              </p>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ═══════════ OUR VISION (KEPT) ═══════════ */}
      <section className="py-32 px-6 lg:px-10">
        <div className="max-w-5xl mx-auto">
          <Reveal>
            <p className="text-sm font-medium text-blue-600 mb-6">Our Vision</p>
          </Reveal>
          <Reveal delay={0.1}>
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-semibold text-[#1d1d1f] tracking-tight leading-[1.1] mb-10 max-w-4xl">
              Create more. Edit less. <span className="italic font-light text-[#424245]">Let LENSEIQ do the work.</span>
            </h2>
          </Reveal>
          <Reveal delay={0.2}>
            <p className="text-lg sm:text-xl text-[#424245] leading-relaxed max-w-3xl font-light">
              We're not trying to replace editors, we're trying to make editing simpler. Upload the video, go grab
              a coffee, and come back to clips you'd actually post.
            </p>
          </Reveal>
        </div>
      </section>
    </GridBackground>
  );
}
