const fs = require('fs');
let c = fs.readFileSync('app/tickets/TicketListClient.tsx', 'utf8');

c = c.replace(/if\s*\(statusFilter\)\s*\{\s*const\s*statuses\s*=\s*statusFilter\.split\(\',\'\)\s*list\s*=\s*list\.filter\(\(t\)\s*=>\s*statuses\.includes\((?:t\.status|t\.status\.toLowerCase\(\))\)\)\s*\}/g, 
`if (statusFilter) {
      const statuses = statusFilter.split(',').map(s => s.toLowerCase())
      list = list.filter((t) => statuses.includes(t.status.toLowerCase()))
    }`);

c = c.replace(/if\s*\(priorityFilter\)\s*list\s*=\s*list\.filter\(\(t\)\s*=>\s*t\.priority\s*===\s*priorityFilter\)/g, 
`if (priorityFilter) list = list.filter((t) => t.priority.toLowerCase() === priorityFilter.toLowerCase())`);

c = c.replace(/if\s*\(categoryFilter\)\s*list\s*=\s*list\.filter\(\(t\)\s*=>\s*t\.category\s*===\s*categoryFilter\)/g, 
`if (categoryFilter) list = list.filter((t) => t.category.toLowerCase() === categoryFilter.toLowerCase())`);

fs.writeFileSync('app/tickets/TicketListClient.tsx', c, 'utf8');
