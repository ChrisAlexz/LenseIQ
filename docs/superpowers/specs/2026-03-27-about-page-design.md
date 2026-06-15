# About Page Design Spec

## Overview

A dedicated `/about` route for AI AutoReel with a segmented panel layout. Each section occupies a full-width panel with scroll-triggered animations. The page uses the same `GridBackground` component as the landing page but with a shifted `CelestialSphere` hue to differentiate it while staying cohesive.

## Background

- Reuse `GridBackground` with `CelestialSphere` at a different hue (e.g. `hue={280}` — purple/violet shift vs landing page's `hue={220}`)
- Same dark base, same overlay opacity, different particle color
- Navbar gets an "About" link added

## Page Structure — 5 Segmented Panels

### Panel 1: Hero Statement
- Full viewport height, vertically centered content
- Left side: emerald label "About AutoReel", large headline ("We turn raw game footage into viral highlights — automatically."), body text mentioning ACM @ UT Arlington, team of 6 students
- Right side: decorative element (subtle emerald gradient shape or particle accent)
- Expo-inspired editorial feel — large type, generous whitespace

### Panel 2: What We Do
- Emerald label "What We Do"
- 3 stat counter cards in a row:
  - **5** — Sports Supported
  - **97%** — Detection Accuracy
  - **<3min** — Processing Time
- Cards: dark bg (`rgba(255,255,255,0.03)`), subtle border, centered text, emerald numbers
- Below cards: paragraph describing the technical pipeline (Whisper audio analysis, custom CV for action detection, crowd noise analysis, confidence scoring, two export formats)

### Panel 3: Why AutoReel
- Emerald label "Why AutoReel"
- Side-by-side comparison grid (2 columns):
  - **Left — "Traditional Editing"**: muted styling, list of pain points with "x" marks (hours of scrubbing, subjective picks, expensive software, no captions)
  - **Right — "AutoReel"**: emerald-highlighted card with border, list of advantages with checkmarks (minutes not hours, AI-scored confidence, free/browser-based, Whisper auto-captions)

### Panel 4: Our Vision
- Emerald label "Our Vision"
- Large editorial headline: "Every athlete deserves a highlight reel. We're making that automatic."
- Body paragraph about expanding beyond 5 sports, real-time processing goal, becoming the standard pipeline for sports content at all levels

### Panel 5: The Team
- Emerald label "The Team"
- Subtitle: "Built by 6 students from ACM @ UT Arlington"
- 6 member placeholders in a row (avatar circles with emerald accent borders)
- Member names below each avatar

## Technical Details

### File: `frontend/pages/about.js`
- New page component in Pages Router
- Imports: `GridBackground`, `motion` from framer-motion, `Reveal` helper (extracted or duplicated from index.js)
- Each panel is a `<section>` with `py-32 px-6 lg:px-10` padding
- Scroll-triggered fade-in via `Reveal` wrapper (same pattern as landing page)

### Navbar Update: `frontend/components/ui/tubelight-navbar.tsx`
- Add "About" link pointing to `/about`

### Footer
- Reuse the same footer markup from the landing page

## Animations
- Each panel fades in on scroll (reuse `Reveal` component pattern from index.js)
- Stat numbers: count-up animation on scroll into view
- Comparison panel: left and right columns stagger in
- Simple, not cinematic — no letterbox/grain effects

## Design Tokens
- Background: `GridBackground` with `CelestialSphere hue={280}`
- Accent: emerald-400 (`#34d399`) for labels, stats, highlights
- Text: white for headlines, `white/70` for body, `white/30` for secondary
- Cards: `bg-white/[0.03]`, `border-white/[0.08]`
- Comparison highlight card: `bg-emerald-500/5`, `border-emerald-500/15`
