const fs = require('fs');
let c = fs.readFileSync('app/actions/tickets.ts', 'utf8');
c = c.replace(/redirect\('\/tickets'\)/g, "redirect('/tickets?created=true')");
fs.writeFileSync('app/actions/tickets.ts', c, 'utf8');
