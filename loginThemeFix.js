const fs = require('fs');
let content = fs.readFileSync('app/login/page.tsx', 'utf8');

// Container
content = content.replace(
  /className="min-h-screen grid lg:grid-cols-2 bg-zinc-950 text-zinc-100 font-sans selection:bg-indigo-500\/30 selection:text-indigo-200 relative overflow-hidden"/g,
  `className="min-h-screen grid lg:grid-cols-2 font-sans relative overflow-hidden" style={{ background: 'var(--bg-base)', color: 'var(--text-primary)' }}`
);

// Logo Background
content = content.replace(
  /className="w-full h-full bg-zinc-950 rounded-\[11px\] flex items-center justify-center"/g,
  `className="w-full h-full rounded-[11px] flex items-center justify-center" style={{ background: 'var(--bg-base)' }}`
);

// Text colors
content = content.replace(/text-zinc-100/g, 'text-[var(--text-primary)]');
content = content.replace(/text-zinc-200/g, 'text-[var(--text-primary)]');
content = content.replace(/text-zinc-300/g, 'text-[var(--text-secondary)]');
content = content.replace(/text-zinc-400/g, 'text-[var(--text-muted)]');
content = content.replace(/text-zinc-500/g, 'text-[var(--text-muted)]');
content = content.replace(/text-white/g, 'text-[var(--text-primary)]');

// Backgrounds
content = content.replace(/bg-zinc-950/g, 'bg-[var(--bg-base)]');
content = content.replace(/bg-zinc-900\/80/g, 'bg-[var(--bg-surface)]');
content = content.replace(/bg-zinc-900\/90/g, 'bg-[var(--bg-surface)]');
content = content.replace(/bg-zinc-900\/60/g, 'bg-[var(--bg-surface)]');
content = content.replace(/bg-zinc-900/g, 'bg-[var(--bg-surface)]');
content = content.replace(/hover:bg-zinc-850/g, 'hover:bg-[var(--bg-hover)]');
content = content.replace(/bg-white\/5/g, 'bg-[var(--bg-hover)]');

// Borders
content = content.replace(/border-white\/10/g, 'border-[var(--border)]');
content = content.replace(/border-white\/5/g, 'border-[var(--border)]');
content = content.replace(/hover:border-white\/20/g, 'hover:border-[var(--border-hover)]');

// Also update the Right Column background overlay
content = content.replace(/bg-zinc-900\/30/g, 'bg-[var(--bg-elevated)]');

fs.writeFileSync('app/login/page.tsx', content);
