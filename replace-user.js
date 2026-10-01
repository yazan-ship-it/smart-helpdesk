const fs = require('fs');
let c = fs.readFileSync('app/tickets/layout.tsx', 'utf8');

if (!c.includes('import UserDropdown')) {
  c = c.replace(/import ThemeSwitcher from '@\/app\/components\/ThemeSwitcher'\s*/, '');
  c = c.replace(/import \{ prisma \} from '@\/lib\/db'/, `import { prisma } from '@/lib/db'\nimport UserDropdown from '@/app/components/UserDropdown'`);
}

c = c.replace(/<ThemeSwitcher \/>[\s\S]*?<form action=\{logout\} className="flex items-center">[\s\S]*?<\/form>\s*<\/div>/g, 
`<UserDropdown user={{ name: session?.name || 'User', role: session?.role === 'IT_SUPPORT' ? 'IT Support' : 'Employee' }} />`);

// Remove any duplicate separating lines
c = c.replace(/<div className="h-6 w-px bg-\[var\(--border\)\] mx-1" \/>\s*<UserDropdown/g, '<UserDropdown');

fs.writeFileSync('app/tickets/layout.tsx', c, 'utf8');
