const fs = require('fs');

// 1. Update app/login/page.tsx
let pagePath = 'app/login/page.tsx';
let page = fs.readFileSync(pagePath, 'utf8');

// Theme Switcher Fix
page = page.replace(
  /<div className="fixed top-5 right-6 z-50">\s*<ThemeSwitcher placement="top" \/>\s*<\/div>/g,
  '<div className="fixed top-6 right-6 z-[100]">\n    <ThemeSwitcher />\n  </div>'
);

// Right Column Background Fix
page = page.replace(
  /className="p-8 sm:p-10 lg:p-12 xl:p-14 hidden lg:flex flex-col justify-center min-h-screen relative overflow-hidden bg-slate-50\/70 dark:bg-zinc-950\/50"/g,
  'className="p-8 sm:p-10 lg:p-12 xl:p-14 hidden lg:flex flex-col justify-center min-h-screen relative overflow-hidden bg-slate-50 dark:bg-zinc-950/50"'
);

// Sandbox Container Top Margin Fix
page = page.replace(
  /<div className="flex-1 flex flex-col justify-center w-full max-w-xl mx-auto relative z-10 pt-4">/g,
  '<div className="flex-1 flex flex-col justify-center w-full max-w-xl mx-auto relative z-10 mt-20">'
);

fs.writeFileSync(pagePath, page);

// 2. Update TicketFlowSimulator.tsx Text Contrast
let simPath = 'app/login/TicketFlowSimulator.tsx';
let sim = fs.readFileSync(simPath, 'utf8');

sim = sim.replace(
  /<h2 className="text-2xl font-bold tracking-tight text-foreground">/g,
  '<h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-foreground">'
);
sim = sim.replace(
  /<p className="text-sm text-muted-foreground">/g,
  '<p className="text-sm text-slate-600 dark:text-muted-foreground">'
);

fs.writeFileSync(simPath, sim);

console.log('Fixed UI issues.');
