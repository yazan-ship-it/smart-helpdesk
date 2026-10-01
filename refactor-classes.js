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

  // Backgrounds
  content = content.replace(/\bbg-white dark:bg-zinc-900\/80\b/g, 'bg-card');
  content = content.replace(/\bbg-white dark:bg-zinc-900\b/g, 'bg-card');
  content = content.replace(/\bbg-gray-50 dark:bg-zinc-950\/70\b/g, 'bg-background');
  content = content.replace(/\bbg-gray-50 dark:bg-zinc-950\/50\b/g, 'bg-background');
  content = content.replace(/\bbg-gray-50 dark:bg-zinc-950\b/g, 'bg-background');
  content = content.replace(/\bbg-gray-100 dark:bg-zinc-800\b/g, 'bg-muted');
  
  // Clean up any remaining explicit dark and light backgrounds requested
  content = content.replace(/\bbg-white\b/g, 'bg-background');
  content = content.replace(/\bbg-black\b/g, 'bg-background');
  content = content.replace(/\bbg-gray-900\b/g, 'bg-foreground');
  content = content.replace(/\bdark:bg-gray-900\b/g, '');
  content = content.replace(/\bbg-zinc-900\b/g, 'bg-card');
  content = content.replace(/\bbg-zinc-950\b/g, 'bg-background');

  // Text
  content = content.replace(/\btext-gray-900 dark:text-gray-100\b/g, 'text-foreground');
  content = content.replace(/\btext-gray-900 dark:text-white\b/g, 'text-foreground');
  content = content.replace(/\btext-white\b/g, 'text-background'); // often used on dark buttons
  content = content.replace(/\btext-black\b/g, 'text-foreground');
  content = content.replace(/\btext-gray-900\b/g, 'text-foreground');
  content = content.replace(/\bdark:text-white\b/g, '');
  content = content.replace(/\btext-zinc-100\b/g, 'text-foreground');

  // Muted Text
  content = content.replace(/\btext-gray-600 dark:text-gray-400\b/g, 'text-muted-foreground');
  content = content.replace(/\btext-gray-600 dark:text-zinc-300\b/g, 'text-muted-foreground');
  content = content.replace(/\btext-gray-500\b/g, 'text-muted-foreground');
  content = content.replace(/\btext-gray-400\b/g, 'text-muted-foreground');
  content = content.replace(/\btext-gray-600\b/g, 'text-muted-foreground');
  content = content.replace(/\btext-slate-400\b/g, 'text-muted-foreground');
  content = content.replace(/\btext-zinc-400\b/g, 'text-muted-foreground');

  // Borders
  content = content.replace(/\bborder-gray-200 dark:border-white\/10\b/g, 'border-border');
  content = content.replace(/\bborder-gray-100 dark:border-white\/5\b/g, 'border-border');
  content = content.replace(/\bborder-gray-300 dark:border-white\/20\b/g, 'border-border');
  content = content.replace(/\bborder-gray-200\b/g, 'border-border');
  content = content.replace(/\bdark:border-gray-800\b/g, '');
  content = content.replace(/\bdark:border-white\/10\b/g, '');

  // specific fixes for multiple spaces left over
  content = content.replace(/  +/g, ' ');
  content = content.replace(/className=" /g, 'className="');
  content = content.replace(/ "/g, '"');

  fs.writeFileSync(file, content, 'utf8');
});
