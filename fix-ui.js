const fs = require('fs');

let login = fs.readFileSync('app/login/page.tsx', 'utf8');
// Fix handleQuickLogin signature
login = login.replace(/roleKey: 'alice' \| 'bob'/g, "roleKey: 'alice' | 'bob' | 'mike'");
login = login.replace(/const \[activeDemoRole, setActiveDemoRole\] = useState\<'alice' \| 'bob' \| null\>\(null\)/g, "const [activeDemoRole, setActiveDemoRole] = useState<'alice' | 'bob' | 'mike' | null>(null)");

// Add Mike button
const bobBtn = `{/* IT Support (Bob) */}
            <button
              type="button"
              onClick={() =>
                handleQuickLogin('bob@company.com', 'support123', 'IT Support (Bob)', 'bob')
              }
              disabled={isWorking}
              className={\`group flex flex-col items-start p-3 rounded-xl border transition-all text-left cursor-pointer relative overflow-hidden \${
                activeDemoRole === 'bob' && isWorking
                  ? 'bg-indigo-500/10 border-indigo-500/50 ring-1 ring-indigo-500/30'
                  : 'bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] border-[var(--border)] hover:border-indigo-500/40'
              }\`}
            >
              <div className="flex items-center justify-between w-full mb-1">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 flex items-center justify-center text-xs font-bold">
                    <Shield className="w-3.5 h-3.5" />
                  </span>
                  <span className="text-xs font-semibold text-[var(--text-primary)] group-hover:text-[var(--text-primary)] transition-colors">
                    IT Support
                  </span>
                </div>
                {activeDemoRole === 'bob' && isWorking && (
                  <Loader2 className="w-3.5 h-3.5 text-indigo-400 animate-spin" />
                )}
              </div>
              <p className="text-[11px] text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors">
                Bob (Specialist)
              </p>
            </button>`;

const mikeBtn = `{/* IT Support (Mike) */}
            <button
              type="button"
              onClick={() =>
                handleQuickLogin('mike@company.com', 'support123', 'IT Support (Mike)', 'mike')
              }
              disabled={isWorking}
              className={\`group flex flex-col items-start p-3 rounded-xl border transition-all text-left cursor-pointer relative overflow-hidden \${
                activeDemoRole === 'mike' && isWorking
                  ? 'bg-indigo-500/10 border-indigo-500/50 ring-1 ring-indigo-500/30'
                  : 'bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] border-[var(--border)] hover:border-indigo-500/40'
              }\`}
            >
              <div className="flex items-center justify-between w-full mb-1">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 flex items-center justify-center text-xs font-bold">
                    <Shield className="w-3.5 h-3.5" />
                  </span>
                  <span className="text-xs font-semibold text-[var(--text-primary)] group-hover:text-[var(--text-primary)] transition-colors">
                    IT Support
                  </span>
                </div>
                {activeDemoRole === 'mike' && isWorking && (
                  <Loader2 className="w-3.5 h-3.5 text-indigo-400 animate-spin" />
                )}
              </div>
              <p className="text-[11px] text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors">
                Mike (Specialist)
              </p>
            </button>`;

// Update grid-cols-2 to grid-cols-1 sm:grid-cols-3
login = login.replace(/className="grid grid-cols-2 gap-2\.5"/g, 'className="grid grid-cols-1 sm:grid-cols-3 gap-2.5"');

if (login.includes(bobBtn)) {
  login = login.replace(bobBtn, bobBtn + '\n\n' + mikeBtn);
} else {
  console.log('Exact matching for bobBtn failed.');
}

// Fix contrast issues on login AI Card
login = login.replace(/shadow-\[inset_0_1px_0_0_rgba\(255,255,255,0\.12\)\] shadow-md  p-5/g, 'shadow-md p-5');
login = login.replace(/rounded-2xl bg-\[var\(--bg-surface\)\] border border-\[var\(--border\)\]/g, 'rounded-2xl bg-card dark:bg-card border border-border');
login = login.replace(/bg-indigo-50\/50 dark:bg-indigo-950\/40 border border-indigo-100 dark:border-indigo-500\/30 shadow-sm dark:shadow-\[inset_0_1px_0_0_rgba\(99,102,241,0\.2\)\]/g, 'bg-card dark:bg-card border border-border shadow-sm');
login = login.replace(/text-\[var\(--text-primary\)\]/g, 'text-foreground');
login = login.replace(/text-\[var\(--text-secondary\)\]/g, 'text-muted-foreground');

// Fix badge text colors
login = login.replace(/text-\[10px\] font-mono px-2 py-0\.5 rounded-full bg-emerald-100 dark:bg-emerald-950 dark:bg-emerald-100 dark:bg-emerald-950 dark:bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 dark:text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500\/30/g, 'text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 border border-border');
login = login.replace(/text-indigo-700 dark:text-indigo-300/g, 'text-foreground');
login = login.replace(/text-indigo-600 dark:text-indigo-400/g, 'text-primary');

fs.writeFileSync('app/login/page.tsx', login, 'utf8');

// Now fix TicketDetailClient.tsx
let ticketDetail = fs.readFileSync('app/tickets/[id]/TicketDetailClient.tsx', 'utf8');
ticketDetail = ticketDetail.replace(/bg-muted\/50/g, 'bg-card dark:bg-card');
ticketDetail = ticketDetail.replace(/bg-emerald-100 dark:bg-emerald-950 dark:bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 dark:text-emerald-800 dark:text-emerald-300 border border-emerald-500\/30/g, 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 border border-border');
ticketDetail = ticketDetail.replace(/text-emerald-800 dark:text-emerald-300 dark:text-emerald-400/g, 'text-emerald-800 dark:text-emerald-300');
fs.writeFileSync('app/tickets/[id]/TicketDetailClient.tsx', ticketDetail, 'utf8');

console.log('Modifications completed.');
