/**
 * Skill-based auto-assignment: pick the available, approved IT agent whose
 * skills include the ticket's category and who has the fewest open tickets.
 * If nobody matches, the ticket stays OPEN in the unassigned queue.
 */

import { prisma } from '@/lib/db'
import { hasSkill } from '@/lib/skills'

export type DispatchResult =
  | { assigned: true; agentId: string; agentName: string; status: 'ASSIGNED' }
  | { assigned: false; assignedToId: null; status: 'OPEN' }

export async function resolveAutoAssignment(category: string): Promise<DispatchResult> {
  const agents = await prisma.user.findMany({
    where: { role: 'IT_SUPPORT', accountStatus: 'APPROVED', isAvailable: true },
    select: {
      id: true,
      name: true,
      skills: true,
      _count: { select: { assignedTickets: { where: { status: { notIn: ['RESOLVED', 'CLOSED'] } } } } },
    },
  })

  // Exact match on the parsed skill list (a substring check on the JSON text
  // would let "Email" match "Email & Communication")
  const candidates = agents
    .filter((a) => hasSkill(a.skills, category.trim()))
    .sort((a, b) => a._count.assignedTickets - b._count.assignedTickets)

  const agent = candidates[0]
  if (!agent) return { assigned: false, assignedToId: null, status: 'OPEN' }
  return { assigned: true, agentId: agent.id, agentName: agent.name, status: 'ASSIGNED' }
}
