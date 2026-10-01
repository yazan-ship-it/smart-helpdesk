const fs = require('fs');
let c = fs.readFileSync('app/components/UserDropdown.tsx', 'utf8');

c = c.replace(/const positionClasses = placement === 'top'\s*\?\s*'bottom-full mb-2 right-0 origin-bottom-right'\s*:\s*'top-full mt-2 right-0 origin-top-right'/,
  "const positionClasses = placement === 'top' ? 'bottom-[calc(100%+8px)] left-0 origin-bottom-left w-full' : 'top-[calc(100%+8px)] right-0 origin-top-right w-56'");

// Update the wrapper to w-full if top
c = c.replace(/<div className="relative" ref=\{dropdownRef\}>/,
  "<div className={`relative ${placement === 'top' ? 'w-full' : ''}`} ref={dropdownRef}>");

// Update the button to fill width if top, and swap order so avatar is on left for sidebar
c = c.replace(/<button\s*type="button"\s*onClick=\{\(\) => setIsOpen\(!isOpen\)\}\s*className="flex items-center gap-3 p-1 rounded-xl hover:bg-muted transition-colors focus:outline-none focus:ring-2 focus:ring-primary\/20 cursor-pointer relative z-10"\s*>\s*<div className="text-right hidden sm:block">\s*<p className="text-sm font-medium leading-tight text-foreground">\s*\{user\.name\}\s*<\/p>\s*<p className="text-\[10px\] uppercase tracking-wider font-semibold text-muted-foreground">\s*\{user\.role\}\s*<\/p>\s*<\/div>\s*<div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white shadow-md shadow-indigo-500\/20 bg-indigo-500">\s*\{user\.name\?\.charAt\(0\)\.toUpperCase\(\)\}\s*<\/div>\s*<\/button>/,
`<button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={\`flex items-center gap-3 p-1.5 rounded-xl hover:bg-muted transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer relative z-10 \${placement === 'top' ? 'w-full justify-start' : ''}\`}
      >
        {placement === 'top' && (
          <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white shadow-md shadow-indigo-500/20 bg-indigo-500 shrink-0">
            {user.name?.charAt(0).toUpperCase()}
          </div>
        )}
        <div className={\`\${placement === 'top' ? 'text-left' : 'text-right'} hidden sm:block\`}>
          <p className="text-sm font-medium leading-tight text-foreground">
            {user.name}
          </p>
          <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
            {user.role}
          </p>
        </div>
        {placement === 'bottom-end' && (
          <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white shadow-md shadow-indigo-500/20 bg-indigo-500 shrink-0">
            {user.name?.charAt(0).toUpperCase()}
          </div>
        )}
      </button>`);

// Remove explicit w-56 from absolute div (since it's now handled by positionClasses)
c = c.replace(/className=\{\`absolute w-56 rounded-xl/, "className={`absolute rounded-xl");

fs.writeFileSync('app/components/UserDropdown.tsx', c, 'utf8');
