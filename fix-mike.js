const fs = require('fs');
let login = fs.readFileSync('app/login/page.tsx', 'utf8');

const mikeBtn = `
            {/* IT Support (Mike) */}
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

if (!login.includes('mike@company.com')) {
  login = login.replace(/Bob \(Specialist\)\n\s*<\/p>\n\s*<\/button>/g, match => match + '\n' + mikeBtn);
  fs.writeFileSync('app/login/page.tsx', login, 'utf8');
  console.log('Injected Mike button.');
} else {
  console.log('Mike already added.');
}
