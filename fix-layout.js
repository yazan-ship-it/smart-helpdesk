const fs = require('fs');
let c = fs.readFileSync('app/tickets/layout.tsx', 'utf8');

c = c.replace(/role: session\?\.role === 'IT_SUPPORT' \? 'IT Support' : 'Employee'/, "role: 'Employee'");

c = c.replace(/\{\/\* User footer \*\/\}[\s\S]*?<\/aside>/, 
`{/* User footer */}
        <div className="p-4 border-t border-border flex justify-center">
          <UserDropdown user={{ name: session?.name || 'User', role: 'IT Support' }} />
        </div>
      </aside>`);

fs.writeFileSync('app/tickets/layout.tsx', c, 'utf8');
