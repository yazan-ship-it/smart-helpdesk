const fs = require('fs');
let c = fs.readFileSync('app/tickets/[id]/TicketDetailClient.tsx', 'utf8');

c = c.replace(/<div\s*className="absolute left-4 -translate-x-1\/2 top-3 w-7 h-7 rounded-full flex items-center justify-center text-\[10px\] font-bold text-foreground shadow-md  shrink-0 z-10"\s*style=\{\{\s*background: isSupport\s*\? 'linear-gradient\(135deg, #6366f1, #06b6d4\)'\s*: 'linear-gradient\(135deg, #a78bfa, #f472b6\)',\s*\}\}\s*>/g, 
`<div
  className={\`absolute left-4 -translate-x-1/2 top-3 w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 z-10 \${isSupport ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}\`}
>`);

c = c.replace(/<div className="absolute left-4 -translate-x-1\/2 top-1\/2 -translate-y-1\/2 w-7 h-7 rounded-full bg-card border border-border flex items-center justify-center text-muted-foreground  shadow-sm shrink-0 z-10">/g, 
`<div className="absolute left-4 -translate-x-1/2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-muted/50 border border-border flex items-center justify-center text-muted-foreground shadow-sm shrink-0 z-10">`);

c = c.replace(/before:bg-background\/10/g, 'before:bg-border');

fs.writeFileSync('app/tickets/[id]/TicketDetailClient.tsx', c, 'utf8');
