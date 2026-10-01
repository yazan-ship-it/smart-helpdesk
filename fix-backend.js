const fs = require('fs');

// 1. Fix Critical Counter style in layout.tsx
let layout = fs.readFileSync('app/tickets/layout.tsx', 'utf8');
layout = layout.replace(
  /\{critical > 0 && <span className="text-\[10px\] bg-red-500\/10 text-red-500 font-bold px-1\.5 py-0\.5 rounded-md">\{critical\}<\/span>\}/g,
  '{critical > 0 && <span className="text-[10px] bg-red-500 text-white font-bold px-1.5 py-0.5 rounded-md">{critical}</span>}'
);
fs.writeFileSync('app/tickets/layout.tsx', layout, 'utf8');

// 2. Strict filtering in app/tickets/page.tsx
let pageStr = fs.readFileSync('app/tickets/page.tsx', 'utf8');
if (!pageStr.includes('searchParams: Promise')) {
  pageStr = pageStr.replace(
    /export default async function TicketsPage\(\) \{/g,
    'export default async function TicketsPage(props: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {'
  );
  pageStr = pageStr.replace(
    /const session = await getSession\(\)/g,
    'const searchParams = await props.searchParams;\n  const session = await getSession()'
  );
  pageStr = pageStr.replace(
    /where: isITSupport \? \{\} : \{ createdById: session\.userId \},/g,
    `where: isITSupport
      ? (searchParams?.assignedToMe === 'true' ? { assignedToId: session.userId } : {})
      : { createdById: session.userId },`
  );
  fs.writeFileSync('app/tickets/page.tsx', pageStr, 'utf8');
}

// 3. Display agent's name/avatar on tickets assigned to them to prevent overlapping work in TicketListClient.tsx
let listClient = fs.readFileSync('app/tickets/TicketListClient.tsx', 'utf8');
const oldAssignedTo = `{ticket.assignedTo && (
                  <span className="inline-flex items-center gap-1">
                    <span style={{ color: 'var(--text-xmuted)' }}>→</span>
                    <span
                      className="font-medium px-1.5 py-0.5 rounded text-[11px]"
                      style={{
                        color: 'var(--brand)',
                        background: 'var(--brand-muted)',
                        border: '1px solid var(--border-focus)',
                      }}
                    >
                      {ticket.assignedTo.name}
                    </span>
                  </span>
                )}`;

const newAssignedTo = `{ticket.assignedTo && (
                  <span className="inline-flex items-center gap-1">
                    <span style={{ color: 'var(--text-xmuted)' }}>→</span>
                    <span
                      className="inline-flex items-center gap-1 font-medium px-1.5 py-0.5 rounded-full text-[11px]"
                      style={{
                        color: 'var(--brand)',
                        background: 'var(--brand-muted)',
                        border: '1px solid var(--border-focus)',
                        paddingRight: '6px'
                      }}
                    >
                      <span className="w-4 h-4 rounded-full bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 flex items-center justify-center text-[8px] font-bold shrink-0">
                        {getInitials(ticket.assignedTo.name)}
                      </span>
                      {ticket.assignedTo.name}
                    </span>
                  </span>
                )}`;

if (listClient.includes(oldAssignedTo)) {
  listClient = listClient.replace(oldAssignedTo, newAssignedTo);
} else {
  // Try looser regex replacement if string match fails
  listClient = listClient.replace(
    /\{ticket\.assignedTo\.name\}/g,
    `<span className="w-4 h-4 rounded-full bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 flex items-center justify-center text-[8px] font-bold shrink-0">
                        {getInitials(ticket.assignedTo.name)}
                      </span>
                      {ticket.assignedTo.name}`
  );
}
fs.writeFileSync('app/tickets/TicketListClient.tsx', listClient, 'utf8');
console.log('Backend and ListClient updates complete.');
