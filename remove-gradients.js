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

  // Timeline rings
  content = content.replace(/ring-4 ring-white dark:ring-zinc-950/g, '');

  // TicketDetailClient.tsx AI Diagnostic Banner
  content = content.replace(/bg-gradient-to-r from-indigo-950\/40 via-zinc-900\/80 to-purple-950\/30 p-5 shadow-xl shadow-indigo-950\/40/g, 'bg-muted/50 p-5 shadow-sm');
  
  // Dividers with gradients
  content = content.replace(/bg-gradient-to-r from-transparent via-indigo-400\/(40|50|60) to-transparent/g, 'bg-border');

  // Buttons with gradients - simplify them
  content = content.replace(/bg-gradient-to-r from-indigo-600 via-indigo-500 to-violet-600 hover:from-indigo-500 (hover:via-indigo-400 )?hover:to-violet-500 active:scale-\[0.99\] transition-all duration-(150|200) shadow-lg shadow-indigo-600\/30 hover:shadow-indigo-(500|600)\/(40|50) hover:-translate-y-0.5 /g, 'bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm transition-colors ');

  content = content.replace(/bg-gradient-to-r from-indigo-600 via-indigo-500 to-violet-600 hover:from-indigo-500 hover:to-violet-500 active:scale-\[0.99\] transition-all duration-150 shadow-lg shadow-indigo-600\/30 hover:shadow-indigo-600\/50 /g, 'bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm transition-colors ');
  
  content = content.replace(/bg-gradient-to-r from-indigo-600 via-indigo-500 to-violet-600 hover:from-indigo-500 hover:to-violet-500 border border-indigo-400\/40 shadow-lg shadow-indigo-600\/30 hover:shadow-indigo-600\/50 /g, 'bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm transition-colors border-transparent ');

  content = content.replace(/bg-gradient-to-r from-transparent via-white\/20 to-transparent/g, 'bg-transparent');

  fs.writeFileSync(file, content, 'utf8');
});
