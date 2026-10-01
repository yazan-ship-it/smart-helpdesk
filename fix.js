const fs = require('fs');
let content = fs.readFileSync('app/login/page.tsx', 'utf8');
const lines = content.split('\n');
const newLines = [
  ...lines.slice(0, 470),
  ' {/* Interactive Ticket Flow Simulator */}',
  ' <div className="flex-1 flex flex-col justify-center w-full max-w-xl mx-auto relative z-10 pt-4">',
  '   <TicketFlowSimulator />',
  ' </div>',
  ...lines.slice(591)
];
fs.writeFileSync('app/login/page.tsx', newLines.join('\n'));
console.log('Done!');
