/**
 * Skill-Based Auto-Assignment Engine
 *
 * Implements the automated dispatch pipeline:
 * - Finds available IT Support users.
 * - Filters by matching skill (based on the ticket's category).
 * - Finds the agent with the fewest open tickets.
 * - assigns to that agent, else fallback to Unassigned queue.
 */

import { prisma } from '@/lib/db'

export type DispatchResult =
  | { assigned: true; agentId: string; agentName: string; status: 'ASSIGNED' }
  | { assigned: false; assignedToId: null; status: 'OPEN' }

export type AssignmentResult =
  | { assigned: true; agentId: string; agentName: string }
  | { assigned: false }

export async function resolveAutoAssignment(category: string): Promise<DispatchResult> {
  const cat = (category || '').trim()

  // Find all active IT Support agents
  const agents = await prisma.user.findMany({
    where: {
      role: 'IT_SUPPORT',
      accountStatus: 'APPROVED',
      isAvailable: true,
      skills: { contains: cat }, // rudimentary check, but works given skills are stored as JSON strings matching category names exactly usually.
    },
    select: {
      id: true,
      name: true,
      _count: {
        select: {
          assignedTickets: {
            where: { status: { notIn: ['RESOLVED', 'CLOSED'] } },
          },
        },
      },
    },
  })

  if (agents.length === 0) {
    // If no exact skill match, maybe try without skill matching just to assign someone?
    // The prompt says: "assign it to an available IT Support agent who has the matching skill...". 
    // We will fallback to unassigned if no matching skill agent is available.
    return {
      assigned: false,
      assignedToId: null,
      status: 'OPEN',
    }
  }

  // Find agent with fewest open tickets
  agents.sort((a, b) => a._count.assignedTickets - b._count.assignedTickets)
  const selectedAgent = agents[0]

  return {
    assigned: true,
    agentId: selectedAgent.id,
    agentName: selectedAgent.name,
    status: 'ASSIGNED',
  }
}

/**
 * Auto-assigns an existing ticket and logs the audit trail.
 */
export async function autoAssignTicket(
  ticketId: string,
  category: string,
  createdByUserId: string,
): Promise<AssignmentResult> {
  const dispatch = await resolveAutoAssignment(category)

  if (dispatch.assigned) {
    await prisma.ticket.update({
      where: { id: ticketId },
      data: {
        assignedToId: dispatch.agentId,
        status: dispatch.status,
      },
    })

    await prisma.ticketHistory.create({
      data: {
        ticketId,
        userId: createdByUserId,
        action: `System auto-assigned ticket to ${dispatch.agentName} based on category (${category}) and workload`,
      },
    })

    return { assigned: true, agentId: dispatch.agentId, agentName: dispatch.agentName }
  } else {
    await prisma.ticket.update({
      where: { id: ticketId },
      data: {
        assignedToId: null,
        status: 'OPEN',
      },
    })

    return { assigned: false }
  }
}
