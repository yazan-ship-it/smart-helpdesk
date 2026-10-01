const fs = require('fs');
let c = fs.readFileSync('app/login/page.tsx', 'utf8');

c = c.replace(/\? 'w-6 bg-indigo-500 shadow-sm shadow-indigo-500\/50'/g, "? 'w-6 bg-primary'");
c = c.replace(/: 'w-1\.5 bg-background\/20 hover:bg-background\/40'/g, ": 'w-1.5 bg-muted-foreground/40 hover:bg-muted-foreground/60'");

c = c.replace(/bg-emerald-50 dark:bg-emerald-500\/15 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500\/30/g, 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30');

fs.writeFileSync('app/login/page.tsx', c, 'utf8');
