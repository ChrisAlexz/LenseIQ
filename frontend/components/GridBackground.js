export default function GridBackground({
  children,
  subtle = false,
  animated = false,
  hue = 220,
}) {
  const accent = `hsl(${hue} 92% 58%)`;
  const accentSoft = `hsla(${hue}, 92%, 58%, 0.18)`;

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#f5f5f7]">
      {/* Ambient gradient + pattern — pinned to the viewport so it doesn't
          repaint on scroll. The blur-3xl layers are the most expensive
          thing on this page; keeping them `fixed` means they rasterize
          once and the scroller just translates past them. */}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0">
        <div
          className="absolute -top-48 left-1/2 h-[520px] w-[760px] rounded-full blur-3xl"
          style={{
            background: `radial-gradient(circle at 30% 30%, ${accentSoft}, transparent 60%)`,
            opacity: subtle ? 0.45 : 0.75,
            transform: "translate3d(-50%, 0, 0)",
            willChange: "transform",
          }}
        />
        <div
          className="absolute -bottom-56 left-1/2 h-[520px] w-[760px] rounded-full blur-3xl"
          style={{
            background: `radial-gradient(circle at 70% 70%, rgba(0, 180, 255, 0.12), transparent 60%)`,
            opacity: subtle ? 0.3 : 0.6,
            transform: "translate3d(-50%, 0, 0)",
            willChange: "transform",
          }}
        />

        <div
          className="absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(15, 23, 42, 0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(15, 23, 42, 0.06) 1px, transparent 1px)",
            backgroundSize: "44px 44px",
            maskImage: "radial-gradient(ellipse at 50% 30%, black 50%, transparent 72%)",
          }}
        />

        {animated && (
          <div
            className="absolute inset-0 opacity-[0.18] animate-[gradient-shift_18s_ease_infinite]"
            style={{
              background: `linear-gradient(120deg, transparent, ${accentSoft}, transparent)`,
              backgroundSize: "220% 220%",
              willChange: "background-position",
            }}
          />
        )}

        <div className="absolute inset-0 bg-gradient-to-b from-white/0 via-white/0 to-[#f5f5f7]" />
      </div>

      {/* Page content */}
      <div className="relative z-10">{children}</div>

      {/* Accent used by some components */}
      <style jsx global>{`
        :root {
          --lenseiq-accent: ${accent};
        }
      `}</style>
    </div>
  );
}
