import React, { useEffect, useRef, ReactNode } from 'react';

interface GlowCardProps {
  children: ReactNode;
  className?: string;
  glowColor?: 'blue' | 'purple' | 'green' | 'red' | 'orange';
  size?: 'sm' | 'md' | 'lg';
  width?: string | number;
  height?: string | number;
  customSize?: boolean;
}

// Inject the glow stylesheet once per document, not per card instance.
let glowStylesInjected = false;
const injectGlowStyles = () => {
  if (glowStylesInjected || typeof document === 'undefined') return;
  glowStylesInjected = true;
  const style = document.createElement('style');
  style.setAttribute('data-glow-styles', '');
  style.textContent = `
    [data-glow] {
      --x: 0;
      --y: 0;
      --xp: 0.5;
      --yp: 0.5;
    }
    [data-glow]::before,
    [data-glow]::after {
      pointer-events: none;
      content: "";
      position: absolute;
      inset: calc(var(--border-size) * -1);
      border: var(--border-size) solid transparent;
      border-radius: calc(var(--radius) * 1px);
      background-size: 100% 100%;
      background-repeat: no-repeat;
      background-position: 50% 50%;
      mask: linear-gradient(transparent, transparent), linear-gradient(white, white);
      mask-clip: padding-box, border-box;
      mask-composite: intersect;
    }
    [data-glow]::before {
      background-image: radial-gradient(
        calc(var(--spotlight-size) * 0.75) calc(var(--spotlight-size) * 0.75) at
        calc(var(--x, 0) * 1px)
        calc(var(--y, 0) * 1px),
        hsl(var(--hue, 210) calc(var(--saturation, 100) * 1%) calc(var(--lightness, 50) * 1%) / var(--border-spot-opacity, 1)), transparent 100%
      );
      filter: brightness(2);
    }
    [data-glow]::after {
      background-image: radial-gradient(
        calc(var(--spotlight-size) * 0.5) calc(var(--spotlight-size) * 0.5) at
        calc(var(--x, 0) * 1px)
        calc(var(--y, 0) * 1px),
        hsl(0 100% 100% / var(--border-light-opacity, 1)), transparent 100%
      );
    }
    [data-glow] [data-glow] {
      position: absolute;
      inset: 0;
      opacity: var(--outer, 1);
      border-radius: calc(var(--radius) * 1px);
      border-width: calc(var(--border-size) * 20);
      filter: blur(calc(var(--border-size) * 10));
      background: none;
      pointer-events: none;
      border: none;
    }
    [data-glow] > [data-glow]::before {
      inset: -10px;
      border-width: 10px;
    }
  `;
  document.head.appendChild(style);
};

const glowColorMap = {
  blue: { base: 220, spread: 200 },
  purple: { base: 280, spread: 300 },
  green: { base: 120, spread: 200 },
  red: { base: 0, spread: 200 },
  orange: { base: 30, spread: 200 },
};

const sizeMap = {
  sm: 'w-48 h-64',
  md: 'w-64 h-80',
  lg: 'w-80 h-96',
};

const GlowCard: React.FC<GlowCardProps> = ({
  children,
  className = '',
  glowColor = 'blue',
  size = 'md',
  width,
  height,
  customSize = false,
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    injectGlowStyles();
    const el = cardRef.current;
    if (!el) return;

    // Track pointer relative to the card itself, not the viewport.
    // This lets us drop `background-attachment: fixed` (the main cause
    // of scroll jank here) because the gradient coordinates now live
    // in the card's own coordinate space.
    let rafId = 0;
    let pendingX = 0;
    let pendingY = 0;
    let pendingW = 1;
    let pendingH = 1;

    const flush = () => {
      rafId = 0;
      el.style.setProperty('--x', pendingX.toFixed(2));
      el.style.setProperty('--xp', (pendingX / pendingW).toFixed(2));
      el.style.setProperty('--y', pendingY.toFixed(2));
      el.style.setProperty('--yp', (pendingY / pendingH).toFixed(2));
    };

    const syncPointer = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      pendingX = e.clientX - rect.left;
      pendingY = e.clientY - rect.top;
      pendingW = rect.width || 1;
      pendingH = rect.height || 1;
      if (!rafId) rafId = requestAnimationFrame(flush);
    };

    el.addEventListener('pointermove', syncPointer);
    return () => {
      el.removeEventListener('pointermove', syncPointer);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);

  const { base, spread } = glowColorMap[glowColor];

  const getSizeClasses = () => {
    if (customSize) return '';
    return sizeMap[size];
  };

  const getInlineStyles = (): React.CSSProperties & Record<string, string> => {
    const baseStyles: Record<string, string> = {
      '--base': String(base),
      '--spread': String(spread),
      '--radius': '14',
      '--border': '3',
      '--backdrop': 'hsl(0 0% 100% / 0.9)',
      '--backup-border': 'var(--backdrop)',
      '--size': '200',
      '--outer': '1',
      '--border-size': 'calc(var(--border, 2) * 1px)',
      '--spotlight-size': 'calc(var(--size, 150) * 1px)',
      '--hue': 'calc(var(--base) + (var(--xp, 0) * var(--spread, 0)))',
      backgroundImage: `radial-gradient(
        var(--spotlight-size) var(--spotlight-size) at
        calc(var(--x, 0) * 1px)
        calc(var(--y, 0) * 1px),
        hsl(var(--hue, 210) calc(var(--saturation, 100) * 1%) calc(var(--lightness, 70) * 1%) / var(--bg-spot-opacity, 0.1)), transparent
      )`,
      backgroundColor: 'var(--backdrop, transparent)',
      backgroundSize: '100% 100%',
      backgroundPosition: '50% 50%',
      backgroundRepeat: 'no-repeat',
      border: 'var(--border-size) solid var(--backup-border)',
      position: 'relative',
      touchAction: 'none',
    };

    if (width !== undefined) {
      baseStyles.width = typeof width === 'number' ? `${width}px` : width;
    }
    if (height !== undefined) {
      baseStyles.height = typeof height === 'number' ? `${height}px` : height;
    }

    return baseStyles as React.CSSProperties & Record<string, string>;
  };

  return (
    <div
      ref={cardRef}
      data-glow
      style={getInlineStyles()}
      className={`
        ${getSizeClasses()}
        ${!customSize ? 'aspect-[3/4]' : ''}
        rounded-2xl
        relative
        grid
        grid-rows-[1fr_auto]
        shadow-[0_1rem_2rem_-1rem_black]
        p-4
        gap-4
        ${className}
      `}
    >
      <div ref={innerRef} data-glow></div>
      {children}
    </div>
  );
};

export { GlowCard };
