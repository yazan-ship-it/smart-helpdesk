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

  // 1. Chart Labels (TicketListClient.tsx)
  content = content.replace(/fill: 'var\(--text-muted\)'/g, "fill: 'var(--text-primary)'");
  content = content.replace(/cursor=\{\{ fill: 'var\(--bg-hover\)' \}\}/g, "cursor={{ fill: 'var(--bg-hover)' }}"); // keep
  
  // 2. AI Confidence Badges (new/page.tsx and TicketDetailClient.tsx)
  content = content.replace(/bg-emerald-[0-9]+\/[0-9]+/g, 'bg-emerald-100 dark:bg-emerald-950');
  content = content.replace(/bg-emerald-[0-9]+\s/g, 'bg-emerald-100 dark:bg-emerald-950 ');
  content = content.replace(/text-emerald-[0-9]+\s/g, 'text-emerald-800 dark:text-emerald-300 ');
  content = content.replace(/border border-emerald-[0-9]+\/[0-9]+/g, 'border border-emerald-500/30');

  // 3. Invisible Slider / Navigation Dots (app/login/page.tsx)
  // Look for the slider pill dots
  content = content.replace(/bg-white\/[0-9]+/g, 'bg-muted-foreground/40');
  content = content.replace(/bg-zinc-[0-9]+\/[0-9]+/g, 'bg-muted-foreground/40');
  content = content.replace(/className=\{\`h-1\.5 rounded-full transition-all duration-300 cursor-pointer \$\{\s*index === activeSlide \? 'w-6 bg-primary' : 'w-2 bg-muted-foreground\/40'\s*\}\`\}/g, "className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${index === activeSlide ? 'w-6 bg-primary' : 'w-2 bg-muted-foreground/40'}`}");

  content = content.replace(/\? 'w-6 bg-white' : 'w-2 bg-muted-foreground\/40'/g, "? 'w-6 bg-primary' : 'w-2 bg-muted-foreground/40'");
  content = content.replace(/\? 'w-6 bg-white' : 'w-2 bg-white\/20'/g, "? 'w-6 bg-primary' : 'w-2 bg-muted-foreground/40'");

  // 4. Timeline Action Icons & Avatar Borders
  content = content.replace(/shadow-md shadow-indigo-500\/20/g, 'shadow-sm');
  content = content.replace(/shadow-xl shadow-black\/5/g, 'shadow-md');
  content = content.replace(/shadow-2xl shadow-black\/10/g, 'shadow-md');
  content = content.replace(/shadow-2xl z-\[100\]/g, 'shadow-md z-[100]');

  if (content !== original) {
    fs.writeFileSync(file, content, 'utf8');
  }
});
