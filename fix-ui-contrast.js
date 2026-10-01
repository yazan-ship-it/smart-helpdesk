const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) { 
      results = results.concat(walk(file));
    } else { 
      if (file.endsWith('.tsx') || file.endsWith('.ts')) results.push(file);
    }
  });
  return results;
}

const files = walk('app');

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let original = content;

  // 1. Fix Recharts visibility in TicketListClient.tsx
  if (file.includes('TicketListClient.tsx') || file.includes('page.tsx')) {
    // Recharts props
    content = content.replace(/fill="#52525b"/g, 'fill="var(--text-primary)"');
    content = content.replace(/fill="#71717a"/g, 'fill="var(--text-muted)"');
    content = content.replace(/stroke="#3f3f46"/g, 'stroke="var(--border)"');
    content = content.replace(/fill="#94a3b8"/g, 'fill="var(--text-muted)"');
    content = content.replace(/stroke="#475569"/g, 'stroke="var(--border)"');
    content = content.replace(/stroke="#1e293b"/g, 'stroke="var(--border)"');
    
    // Fix tooltips
    content = content.replace(/bg-zinc-900 border-zinc-800 text-white/g, 'bg-card border-border text-foreground');
    content = content.replace(/text-zinc-400/g, 'text-muted-foreground');
  }

  // 2. Fix AI Confidence Badge & Diagnostic Box
  content = content.replace(/bg-emerald-100 dark:bg-emerald-900\/30/g, 'bg-emerald-100 dark:bg-emerald-950');
  content = content.replace(/bg-emerald-900\/30/g, 'bg-emerald-950');
  content = content.replace(/shadow-xl shadow-emerald-900\/20/g, 'shadow-sm');

  // 3. Fix Invisible Slider/Navigation Dots & Indicators
  content = content.replace(/bg-white\/20/g, 'bg-muted-foreground/40');
  content = content.replace(/bg-white\/50/g, 'bg-muted-foreground/60');
  content = content.replace(/bg-white\/60/g, 'bg-muted-foreground/60');
  content = content.replace(/bg-zinc-800\/50/g, 'bg-muted-foreground/40');

  // 4. Clean Up Timeline & Avatar Borders
  content = content.replace(/border-4 border-black/g, 'border border-border');
  content = content.replace(/ring-4 ring-white dark:ring-zinc-950/g, 'border border-border');
  content = content.replace(/ring-2 ring-background/g, 'border border-border');

  // 5. Global Shadow & Contrast Reduction
  content = content.replace(/shadow-2xl/g, 'shadow-md');
  content = content.replace(/shadow-xl/g, 'shadow-sm');
  content = content.replace(/shadow-indigo-950\/[0-9]+/g, '');
  content = content.replace(/shadow-purple-[0-9]+\/[0-9]+/g, '');
  content = content.replace(/shadow-emerald-[0-9]+\/[0-9]+/g, '');
  content = content.replace(/shadow-black\/[0-9]+/g, '');
  
  if (content !== original) {
    fs.writeFileSync(file, content, 'utf8');
  }
});
