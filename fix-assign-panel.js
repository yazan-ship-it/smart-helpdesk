const fs = require('fs');
let f = fs.readFileSync('app/tickets/[id]/TicketDetailClient.tsx', 'utf8');

const oldForm = `  {/* Assign Specialist Form */}
  <form onSubmit={handleAssignSubmit} className="space-y-2 pt-2 border-t border-border">
  <label className="block text-xs font-semibold text-foreground">
  Assign Support Specialist
  </label>
  <div className="flex gap-2">
  <select
  value={selectedAssignee}
  onChange={(e) => setSelectedAssignee(e.target.value)}
  className="w-full bg-background dark:bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground dark:text-foreground outline-none transition-all focus:border-indigo-500/60 focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
  disabled={isPendingAssign}
  >
  <option value="">Unassigned</option>
  {itAgents.map((agent) => (
  <option key={agent.id} value={agent.id}>
  {agent.name}
  </option>
  ))}
  </select>

  <button
  type="submit"
  disabled={
  isPendingAssign ||
  !selectedAssignee ||
  selectedAssignee === ticket.assignedToId
  }
  className="btn btn-primary btn-sm shrink-0"
  >
  {isPendingAssign ? (
  <Loader2 className="w-3.5 h-3.5 animate-spin" />
  ) : (
  <UserCheck className="w-3.5 h-3.5" />
  )}
  <span>Assign</span>
  </button>
  </div>
  </form>`;

const newForm = `  {/* Assign / Reassign Specialist Panel */}
  <form onSubmit={handleAssignSubmit} className="space-y-3 pt-2 border-t border-border">
  <div className="flex items-center justify-between">
  <label className="block text-xs font-semibold text-foreground">
  {ticket.assignedTo ? 'Reassign Specialist' : 'Assign Support Specialist'}
  </label>
  {ticket.assignedTo && (
  <span className="text-[10px] text-muted-foreground italic">Current: {ticket.assignedTo.name}</span>
  )}
  </div>
  {/* Agent Cards */}
  <div className="space-y-1.5">
  {itAgents.map((agent) => {
  let agentSkills: string[] = []
  try { agentSkills = JSON.parse(agent.skills || '[]') } catch {}
  const isSelected = selectedAssignee === agent.id
  const isCurrent = ticket.assignedToId === agent.id
  return (
  <button
  key={agent.id}
  type="button"
  onClick={() => setSelectedAssignee(agent.id)}
  disabled={isPendingAssign}
  className={\`w-full flex items-center gap-3 p-2.5 rounded-xl border text-left transition-all cursor-pointer \${
  isSelected
  ? 'border-indigo-500/50 bg-indigo-500/10 ring-1 ring-indigo-500/20'
  : 'border-border hover:border-border hover:bg-muted/50'
  }\`}
  >
  <div className={\`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 \${agent.isAvailable ? 'bg-indigo-500' : 'bg-muted-foreground/50'}\`}>
  {getInitials(agent.name)}
  </div>
  <div className="flex-1 min-w-0">
  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
  <span className="text-xs font-semibold text-foreground truncate">{agent.name}</span>
  {isCurrent && <span className="text-[9px] font-bold uppercase px-1 py-0.5 rounded bg-violet-500/15 text-violet-700 dark:text-violet-300 border border-violet-500/20">Current</span>}
  <span className={\`text-[9px] font-bold uppercase px-1 py-0.5 rounded border \${agent.isAvailable ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20' : 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20'}\`}>
  {agent.isAvailable ? 'Available' : 'Away'}
  </span>
  </div>
  {agentSkills.length > 0 && (
  <div className="flex flex-wrap gap-1">
  {agentSkills.slice(0, 3).map((skill) => (
  <span key={skill} className={\`text-[9px] px-1 py-0.5 rounded bg-muted text-muted-foreground border border-border \${skill.toLowerCase() === ticket.category.toLowerCase() ? 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/20 font-semibold' : ''}\`}>
  {skill}
  </span>
  ))}
  </div>
  )}
  </div>
  {isSelected && <UserCheck className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />}
  </button>
  )
  })}
  </div>
  <button
  type="submit"
  disabled={
  isPendingAssign ||
  !selectedAssignee ||
  selectedAssignee === ticket.assignedToId
  }
  className="btn btn-primary btn-sm w-full"
  >
  {isPendingAssign ? (
  <Loader2 className="w-3.5 h-3.5 animate-spin" />
  ) : (
  <UserCheck className="w-3.5 h-3.5" />
  )}
  <span>{ticket.assignedTo ? 'Reassign Ticket' : 'Assign Ticket'}</span>
  </button>
  </form>`;

if (f.includes(oldForm)) {
  f = f.replace(oldForm, newForm);
  fs.writeFileSync('app/tickets/[id]/TicketDetailClient.tsx', f, 'utf8');
  console.log('Replaced assign form successfully.');
} else {
  console.log('Old form not found exactly. Trying partial replace.');
  // Try just replacing the select element portion
  f = f.replace(
    /\{\/\* Assign Specialist Form \*\/\}[\s\S]*?<\/form>/m,
    newForm
  );
  fs.writeFileSync('app/tickets/[id]/TicketDetailClient.tsx', f, 'utf8');
  console.log('Partial replace done.');
}
