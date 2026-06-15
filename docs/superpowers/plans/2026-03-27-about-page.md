<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>About — AutoReel</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;600;700&family=DM+Sans:ital,wght@0,300;0,400;0,500;1,300&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --green: #34d399;
    --green-dim: rgba(52,211,153,0.12);
    --green-border: rgba(52,211,153,0.18);
    --bg: #0a0d0b;
    --surface: #111512;
    --surface2: #161a17;
    --text: #e8ede9;
    --muted: #6b7a6d;
    --muted2: #3d4a3f;
  }

  html { scroll-behavior: smooth; }

  body {
    font-family: 'DM Sans', sans-serif;
    background: var(--bg);
    color: var(--text);
    line-height: 1.7;
    overflow-x: hidden;
  }

  /* ── NAV ── */
  nav {
    position: fixed; top: 0; left: 0; right: 0; z-index: 100;
    display: flex; align-items: center; justify-content: space-between;
    padding: 18px 48px;
    background: rgba(10,13,11,0.85);
    backdrop-filter: blur(12px);
    border-bottom: 1px solid var(--muted2);
  }
  .nav-logo {
    display: flex; align-items: center; gap: 10px;
    font-family: 'Sora', sans-serif; font-weight: 700; font-size: 16px;
    color: var(--text); text-decoration: none;
  }
  .nav-logo-icon {
    width: 28px; height: 28px; border-radius: 8px;
    background: var(--green-dim); border: 1px solid var(--green-border);
    display: flex; align-items: center; justify-content: center;
  }
  .nav-logo-icon svg { width: 14px; height: 14px; }
  .nav-links { display: flex; gap: 32px; }
  .nav-links a {
    font-size: 14px; color: var(--muted); text-decoration: none;
    transition: color 0.2s;
  }
  .nav-links a:hover, .nav-links a.active { color: var(--text); }
  .nav-links a.active { color: var(--green); }

  /* ── MAIN ── */
  main { padding-top: 80px; }

  /* ── HERO PANEL ── */
  .panel-hero {
    min-height: 92vh;
    display: flex; align-items: center;
    padding: 80px 48px;
    position: relative; overflow: hidden;
  }
  .hero-grid {
    max-width: 1100px; margin: 0 auto; width: 100%;
    display: grid; grid-template-columns: 1fr 380px; gap: 80px; align-items: center;
  }
  .hero-eyebrow {
    font-family: 'Sora', sans-serif;
    font-size: 11px; font-weight: 600; letter-spacing: 3px; text-transform: uppercase;
    color: var(--green); margin-bottom: 24px;
  }
  .hero-headline {
    font-family: 'Sora', sans-serif;
    font-size: clamp(32px, 4vw, 52px);
    font-weight: 700; line-height: 1.15;
    margin-bottom: 24px;
  }
  .hero-headline em {
    font-style: normal; color: var(--green);
  }
  .hero-body {
    font-size: 16px; color: var(--muted); line-height: 1.8; max-width: 520px;
  }
  .hero-visual {
    aspect-ratio: 1;
    border-radius: 24px;
    background: var(--green-dim);
    border: 1px solid var(--green-border);
    display: flex; align-items: center; justify-content: center;
    position: relative; overflow: hidden;
  }
  .hero-visual-inner {
    width: 120px; height: 120px;
    border-radius: 50%;
    border: 1px solid var(--green-border);
    display: flex; align-items: center; justify-content: center;
    animation: pulse 3s ease-in-out infinite;
  }
  .hero-visual-inner::before {
    content: ''; position: absolute;
    width: 200px; height: 200px; border-radius: 50%;
    border: 1px solid rgba(52,211,153,0.08);
    animation: pulse 3s ease-in-out infinite 0.5s;
  }
  .hero-visual-inner::after {
    content: ''; position: absolute;
    width: 280px; height: 280px; border-radius: 50%;
    border: 1px solid rgba(52,211,153,0.04);
    animation: pulse 3s ease-in-out infinite 1s;
  }
  .play-icon {
    width: 48px; height: 48px; color: var(--green); position: relative; z-index: 1;
  }
  @keyframes pulse {
    0%, 100% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.05); opacity: 0.7; }
  }

  /* ── SECTION SHARED ── */
  .panel {
    padding: 100px 48px;
    border-top: 1px solid var(--muted2);
  }
  .panel-inner { max-width: 1100px; margin: 0 auto; }
  .section-eyebrow {
    font-family: 'Sora', sans-serif;
    font-size: 11px; font-weight: 600; letter-spacing: 3px; text-transform: uppercase;
    color: var(--green); margin-bottom: 20px;
  }
  .section-title {
    font-family: 'Sora', sans-serif;
    font-size: clamp(24px, 3vw, 36px); font-weight: 700; line-height: 1.25;
    margin-bottom: 20px;
  }
  .section-body {
    font-size: 15px; color: var(--muted); line-height: 1.85; max-width: 600px;
  }

  /* ── PROBLEM PANEL ── */
  .problem-grid {
    display: grid; grid-template-columns: 1fr 1fr; gap: 48px; margin-top: 56px;
  }
  .problem-card {
    background: var(--surface);
    border: 1px solid var(--muted2);
    border-radius: 16px; padding: 32px;
    transition: border-color 0.3s;
  }
  .problem-card:hover { border-color: rgba(52,211,153,0.3); }
  .problem-card-icon {
    width: 40px; height: 40px; border-radius: 10px;
    background: var(--green-dim); border: 1px solid var(--green-border);
    display: flex; align-items: center; justify-content: center;
    margin-bottom: 20px;
  }
  .problem-card-icon svg { width: 18px; height: 18px; color: var(--green); }
  .problem-card h4 {
    font-family: 'Sora', sans-serif; font-size: 16px; font-weight: 600;
    margin-bottom: 10px;
  }
  .problem-card p { font-size: 14px; color: var(--muted); line-height: 1.75; }

  /* ── SOLUTION / COMPARISON ── */
  .compare-grid {
    display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 48px;
  }
  .compare-col { border-radius: 16px; padding: 32px; }
  .compare-col.before {
    background: var(--surface);
    border: 1px solid var(--muted2);
  }
  .compare-col.after {
    background: var(--green-dim);
    border: 1px solid var(--green-border);
  }
  .compare-col h4 {
    font-family: 'Sora', sans-serif; font-size: 15px; font-weight: 600;
    margin-bottom: 20px; color: var(--muted);
  }
  .compare-col.after h4 { color: var(--green); }
  .compare-list { list-style: none; display: flex; flex-direction: column; gap: 12px; }
  .compare-list li {
    font-size: 14px; display: flex; align-items: flex-start; gap: 10px; line-height: 1.5;
  }
  .compare-list li .icon { flex-shrink: 0; margin-top: 2px; font-size: 13px; }
  .compare-col.before .compare-list li { color: var(--muted); }
  .compare-col.after .compare-list li { color: var(--text); }

  /* ── STATS ── */
  .stats-row {
    display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; margin-top: 48px;
  }
  .stat-card {
    background: var(--surface);
    border: 1px solid var(--muted2);
    border-radius: 16px; padding: 32px; text-align: center;
    transition: border-color 0.3s, transform 0.3s;
  }
  .stat-card:hover { border-color: var(--green-border); transform: translateY(-4px); }
  .stat-number {
    font-family: 'Sora', sans-serif;
    font-size: 42px; font-weight: 700; color: var(--green);
    line-height: 1; margin-bottom: 8px;
  }
  .stat-label { font-size: 13px; color: var(--muted); }

  /* ── VISION ── */
  .vision-panel {
    text-align: center; padding: 120px 48px;
    border-top: 1px solid var(--muted2);
    background: radial-gradient(ellipse 60% 50% at 50% 100%, rgba(52,211,153,0.06), transparent);
  }
  .vision-panel .section-eyebrow { text-align: center; }
  .vision-quote {
    font-family: 'Sora', sans-serif;
    font-size: clamp(22px, 3vw, 38px); font-weight: 700;
    line-height: 1.3; max-width: 740px; margin: 0 auto 24px;
  }
  .vision-quote em { font-style: normal; color: var(--green); }
  .vision-body {
    font-size: 15px; color: var(--muted); max-width: 560px;
    margin: 0 auto; line-height: 1.85;
  }

  /* ── TEAM ── */
  .team-grid {
    display: grid; grid-template-columns: repeat(6, 1fr); gap: 20px; margin-top: 48px;
  }
  .team-card { text-align: center; }
  .team-avatar {
    width: 64px; height: 64px; border-radius: 50%;
    background: var(--green-dim);
    border: 1px solid var(--green-border);
    margin: 0 auto 10px;
    display: flex; align-items: center; justify-content: center;
    font-family: 'Sora', sans-serif; font-size: 18px; font-weight: 700;
    color: var(--green);
    transition: border-color 0.3s, transform 0.3s;
  }
  .team-card:hover .team-avatar {
    border-color: var(--green); transform: translateY(-4px);
  }
  .team-name { font-size: 12px; color: var(--muted); }

  /* ── FOOTER ── */
  footer {
    border-top: 1px solid var(--muted2);
    padding: 32px 48px;
    display: flex; align-items: center; justify-content: space-between;
  }
  footer p { font-size: 13px; color: var(--muted); }
  footer a { color: var(--green); text-decoration: none; }

  /* ── FADE IN ── */
  .fade-in { opacity: 0; transform: translateY(24px); transition: opacity 0.7s ease, transform 0.7s ease; }
  .fade-in.visible { opacity: 1; transform: translateY(0); }

  @media (max-width: 768px) {
    nav { padding: 16px 24px; }
    .panel, .vision-panel { padding: 64px 24px; }
    .panel-hero { padding: 60px 24px; }
    .hero-grid, .problem-grid, .compare-grid { grid-template-columns: 1fr; }
    .hero-visual { display: none; }
    .team-grid { grid-template-columns: repeat(3, 1fr); }
    .stats-row { grid-template-columns: 1fr; }
    footer { flex-direction: column; gap: 12px; text-align: center; }
  }
</style>
</head>
<body>

<!-- NAV -->
<nav>
  <a href="#" class="nav-logo">
    <div class="nav-logo-icon">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:#34d399">
        <polygon points="5 3 19 12 5 21 5 3"/>
      </svg>
    </div>
    autoreel
  </a>
  <div class="nav-links">
    <a href="#">Dashboard</a>
    <a href="#" class="active">About</a>
    <a href="#">Sign Out</a>
  </div>
</nav>

<main>

  <!-- HERO -->
  <section class="panel-hero">
    <div class="hero-grid">
      <div class="fade-in">
        <p class="hero-eyebrow">About AutoReel</p>
        <h1 class="hero-headline">
          Sports happen fast.<br>
          <em>Your highlights shouldn't wait.</em>
        </h1>
        <p class="hero-body">
          AutoReel was built to solve a real problem — the hours wasted manually scrubbing through raw footage just to share a single moment. We wanted to make that disappear entirely, for every athlete, coach, and fan.
        </p>
      </div>
      <div class="hero-visual fade-in" style="transition-delay:0.2s">
        <div class="hero-visual-inner">
          <svg class="play-icon" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="5 3 19 12 5 21 5 3"/>
          </svg>
        </div>
      </div>
    </div>
  </section>

  <!-- THE PROBLEM -->
  <section class="panel">
    <div class="panel-inner">
      <div class="fade-in">
        <p class="section-eyebrow">The Problem</p>
        <h2 class="section-title">Sports content is everywhere.<br>Creating it is still broken.</h2>
        <p class="section-body">
          Every weekend, millions of games are played and recorded — but most of that footage never gets seen. Not because the moments aren't there, but because turning raw video into something shareable takes time, skill, and tools most people don't have.
        </p>
      </div>
      <div class="problem-grid">
        <div class="problem-card fade-in" style="transition-delay:0.1s">
          <div class="problem-card-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
          </div>
          <h4>Hours of manual editing</h4>
          <p>Scrubbing through a 90-minute match to find 3 minutes of highlights isn't a workflow — it's a punishment. Most coaches and athletes simply don't have that time.</p>
        </div>
        <div class="problem-card fade-in" style="transition-delay:0.2s">
          <div class="problem-card-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
            </svg>
          </div>
          <h4>Expensive software, steep learning curve</h4>
          <p>Professional editing tools cost hundreds of dollars per year and take months to learn. That's a barrier that shuts out youth leagues, rec teams, and independent creators.</p>
        </div>
        <div class="problem-card fade-in" style="transition-delay:0.3s">
          <div class="problem-card-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          </div>
          <h4>Great moments go unshared</h4>
          <p>Athletes work hard. Coaches teach. Fans cheer. But without a way to easily capture and distribute those moments, the memories live only in raw footage — or not at all.</p>
        </div>
        <div class="problem-card fade-in" style="transition-delay:0.4s">
          <div class="problem-card-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
            </svg>
          </div>
          <h4>Content creation isn't equal</h4>
          <p>Pro teams have full production crews. Everyone else has a phone and hope. We think that gap shouldn't exist — the tools to tell your story should be available to anyone.</p>
        </div>
      </div>
    </div>
  </section>

  <!-- OUR SOLUTION -->
  <section class="panel">
    <div class="panel-inner">
      <div class="fade-in">
        <p class="section-eyebrow">Our Solution</p>
        <h2 class="section-title">Upload your footage.<br>Get your highlights.</h2>
        <p class="section-body">
          AutoReel handles everything in between. Drop in your raw video, pick your sport, and our system finds, assembles, and delivers a ready-to-share highlight reel — in minutes.
        </p>
      </div>
      <div class="compare-grid fade-in" style="transition-delay:0.2s">
        <div class="compare-col before">
          <h4>Traditional workflow</h4>
          <ul class="compare-list">
            <li><span class="icon">✕</span> Hours scrubbing through footage manually</li>
            <li><span class="icon">✕</span> Costly editing software with a steep learning curve</li>
            <li><span class="icon">✕</span> Inconsistent, subjective clip selection</li>
            <li><span class="icon">✕</span> Still need to caption and format separately</li>
            <li><span class="icon">✕</span> Only accessible to those with time and money</li>
          </ul>
        </div>
        <div class="compare-col after">
          <h4>AutoReel</h4>
          <ul class="compare-list">
            <li><span class="icon">✓</span> Ready in minutes, not hours</li>
            <li><span class="icon">✓</span> Browser-based — no installs, free to start</li>
            <li><span class="icon">✓</span> Consistent, AI-powered moment detection</li>
            <li><span class="icon">✓</span> Captions included, export-ready</li>
            <li><span class="icon">✓</span> Built for every level — rec to varsity</li>
          </ul>
        </div>
      </div>

      <div class="stats-row">
        <div class="stat-card fade-in" style="transition-delay:0.1s">
          <div class="stat-number">5</div>
          <div class="stat-label">Sports supported</div>
        </div>
        <div class="stat-card fade-in" style="transition-delay:0.2s">
          <div class="stat-number">&lt;3m</div>
          <div class="stat-label">Average processing time</div>
        </div>
        <div class="stat-card fade-in" style="transition-delay:0.3s">
          <div class="stat-number">0</div>
          <div class="stat-label">Editing experience required</div>
        </div>
      </div>
    </div>
  </section>

  <!-- VISION -->
  <section class="vision-panel fade-in">
    <p class="section-eyebrow">Our Vision</p>
    <h2 class="vision-quote">
      Every athlete deserves a highlight reel.<br>
      <em>We're making that automatic.</em>
    </h2>
    <p class="vision-body">
      We started AutoReel as six students who love sports and believe AI should be in service of real people — not just big organizations. Our goal is to keep expanding, keep improving, and eventually make AutoReel the default way sports content gets made at every level.
    </p>
  </section>

  <!-- TEAM -->
  <section class="panel">
    <div class="panel-inner">
      <div class="fade-in">
        <p class="section-eyebrow">The Team</p>
        <h2 class="section-title">Built by six students<br>from ACM @ UT Arlington</h2>
        <p class="section-body">
          We're a group of computer science students who built AutoReel because we believed the problem was worth solving. No corporate backing — just curiosity, late nights, and a shared love for sports.
        </p>
      </div>
      <div class="team-grid">
        <div class="team-card fade-in" style="transition-delay:0.1s">
          <div class="team-avatar">A</div>
          <div class="team-name">Member 1</div>
        </div>
        <div class="team-card fade-in" style="transition-delay:0.15s">
          <div class="team-avatar">B</div>
          <div class="team-name">Member 2</div>
        </div>
        <div class="team-card fade-in" style="transition-delay:0.2s">
          <div class="team-avatar">C</div>
          <div class="team-name">Member 3</div>
        </div>
        <div class="team-card fade-in" style="transition-delay:0.25s">
          <div class="team-avatar">D</div>
          <div class="team-name">Member 4</div>
        </div>
        <div class="team-card fade-in" style="transition-delay:0.3s">
          <div class="team-avatar">E</div>
          <div class="team-name">Member 5</div>
        </div>
        <div class="team-card fade-in" style="transition-delay:0.35s">
          <div class="team-avatar">F</div>
          <div class="team-name">Member 6</div>
        </div>
      </div>
    </div>
  </section>

</main>

<footer>
  <p>© 2025 AutoReel — ACM @ UT Arlington</p>
  <p>Built with purpose. <a href="#">Go to Dashboard →</a></p>
</footer>

<script>
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
      }
    });
  }, { threshold: 0.1 });

  document.querySelectorAll('.fade-in').forEach(el => observer.observe(el));
</script>
</body>
</html>