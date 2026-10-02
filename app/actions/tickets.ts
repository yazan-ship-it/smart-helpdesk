'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/session'
import { resolveAutoAssignment, type DispatchResult } from '@/lib/services/assignment'
import { calculateBusinessHoursDeadline, statusChangeFields } from '@/lib/sla'

export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
export type Status = 'OPEN' | 'ASSIGNED' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED'

export type TicketState = {
  error?: string
  fieldErrors?: {
    title?: string[]
    description?: string[]
    category?: string[]
  }
} | undefined

// Valid lifecycle transitions - enforces strict state machine
const VALID_TRANSITIONS: Record<Status, Status[]> = {
  OPEN: ['ASSIGNED'],
  ASSIGNED: ['IN_PROGRESS'],
  IN_PROGRESS: ['RESOLVED'],
  RESOLVED: ['CLOSED'],
  CLOSED: [],
}

function isValidTransition(from: Status, to: Status): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false
}

export async function createTicket(prevState: TicketState, formData: FormData): Promise<TicketState> {
  const session = await getSession()
  if (!session) redirect('/login')

  const title = (formData.get('title') as string)?.trim()
  const description = (formData.get('description') as string)?.trim()
  const category = (formData.get('category') as string)?.trim()
  const priority = (formData.get('priority') as Priority) ?? 'MEDIUM'

  const fieldErrors: NonNullable<TicketState>['fieldErrors'] = {}
  if (!title || title.length < 5) fieldErrors.title = ['Title must be at least 5 characters.']
  if (!description || description.length < 10) fieldErrors.description = ['Description must be at least 10 characters.']
  if (!category) fieldErrors.category = ['Please select a category.']

  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors }
  }

  const settings = await prisma.appSettings.findUnique({ where: { id: 'singleton' } })
  if (settings?.maintenanceMode && session.role !== 'ADMIN') {
    return { error: 'System is in maintenance mode. Ticket creation is temporarily paused.' }
  }

  const attachments = (formData.get('attachmentsJson') as string) || '[]'

  // Generate next ticket number
  const lastTicket = await prisma.ticket.findFirst({
    orderBy: { ticketNumber: 'desc' },
    select: { ticketNumber: true },
  })
  const nextNumber = (lastTicket?.ticketNumber ?? 0) + 1

  // Skill-based auto-dispatch is an admin policy (Settings → auto-assignment), not the requester's choice
  let dispatch: DispatchResult = { assigned: false, assignedToId: null, status: 'OPEN' }
  if (settings?.autoAssignmentEnabled ?? true) {
    dispatch = await resolveAutoAssignment(category)
  }

  // SLA Calculation
  let slaHours = settings?.slaMediumHours ?? 48
  if (priority === 'CRITICAL') slaHours = settings?.slaCriticalHours ?? 4
  else if (priority === 'HIGH') slaHours = settings?.slaHighHours ?? 24
  else if (priority === 'LOW') slaHours = settings?.slaLowHours ?? 72

  const workDaysArray = JSON.parse(settings?.workDays ?? '["Sunday","Monday","Tuesday","Wednesday","Thursday"]')
  const dayMap: Record<string, number> = { "Sunday": 0, "Monday": 1, "Tuesday": 2, "Wednesday": 3, "Thursday": 4, "Friday": 5, "Saturday": 6 }
  const workDaysNumbers = workDaysArray.map((d: string) => dayMap[d])
  const [startHour, startMinute] = (settings?.businessHoursStart ?? "09:00").split(':').map(Number)
  const [endHour, endMinute] = (settings?.businessHoursEnd ?? "17:00").split(':').map(Number)

  const slaDeadline = calculateBusinessHoursDeadline(
    new Date(),
    slaHours,
    {
      startHour,
      startMinute,
      endHour,
      endMinute,
      workDays: workDaysNumbers,
      pauseOnWeekends: settings?.pauseSlaOnWeekends ?? true
    }
  )

  const ticket = await prisma.ticket.create({
    data: {
      ticketNumber: nextNumber,
      title,
      description,
      category,
      priority,
      status: dispatch.status,
      assignedToId: dispatch.assigned ? dispatch.agentId : null,
      attachments,
      slaDeadline,
      createdById: session.userId,
    },
  })

  // Ticket creation audit entry
  await prisma.ticketHistory.create({
    data: {
      ticketId: ticket.id,
      userId: session.userId,
      action: `Ticket #${nextNumber} created`,
    },
  })

  // 3. Automatic Audit Trail Logging
  if (dispatch.assigned) {
    await prisma.ticketHistory.create({
      data: {
        ticketId: ticket.id,
        userId: session.userId,
        action: `System auto-assigned ticket to ${dispatch.agentName} based on category (${category})`,
      },
    })
  } else {
    await prisma.ticketHistory.create({
      data: {
        ticketId: ticket.id,
        userId: session.userId,
        action: `No available specialist found for ${category} — ticket queued in Unassigned`,
      },
    })
  }

  revalidatePath('/tickets')
  redirect('/tickets?created=true')
}

export async function updateTicketStatus(ticketId: string, newStatus: Status): Promise<{ error?: string }> {
  const session = await getSession()
  if (!session || session.role !== 'IT_SUPPORT') {
    return { error: 'Unauthorized: Only IT Support can update ticket status.' }
  }

  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: { assignedTo: { select: { id: true, name: true } } },
  })
  if (!ticket) return { error: 'Ticket not found.' }

  // 🔒 Peer Ticket Edit Lock:
  // Agents can only modify the lifecycle status of tickets strictly assigned to their own ID,
  // or unassigned tickets they explicitly claim.
  if (ticket.assignedToId && ticket.assignedToId !== session.userId) {
    return {
      error: `Assigned to ${ticket.assignedTo?.name || 'another specialist'} - Read Only. Take over ticket to modify status.`,
    }
  }

  const currentStatus = ticket.status as Status

  if (!isValidTransition(currentStatus, newStatus)) {
    return {
      error: `Invalid status transition: ${currentStatus} → ${newStatus}. Valid next statuses: ${(VALID_TRANSITIONS[currentStatus] || []).join(', ') || 'none (terminal state)'}.`,
    }
  }

  // If unassigned, auto-claim the ticket when changing status
  const updateData: { status: Status; assignedToId?: string } = { status: newStatus }
  let claimLog = ''
  if (!ticket.assignedToId) {
    updateData.assignedToId = session.userId
    claimLog = ' claimed and'
  }

  await prisma.ticket.update({
    where: { id: ticketId },
    data: { ...updateData, ...statusChangeFields(ticket, newStatus) },
  })

  await prisma.ticketHistory.create({
    data: {
      ticketId,
      userId: session.userId,
      action: `Ticket${claimLog} status changed from ${currentStatus} to ${newStatus}`,
    },
  })

  revalidatePath('/tickets')
  revalidatePath(`/tickets/${ticketId}`)
  return {}
}

export async function reassignTicket(ticketId: string, newAssigneeId: string): Promise<{ error?: string }> {
  const session = await getSession()
  if (!session || session.role !== 'ADMIN') {
    return { error: 'Unauthorized: Only Admins can reassign tickets.' }
  }

  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } })
  if (!ticket) return { error: 'Ticket not found.' }

  const newAssignee = await prisma.user.findUnique({ where: { id: newAssigneeId } })
  if (!newAssignee) return { error: 'Assignee not found.' }

  await prisma.ticket.update({
    where: { id: ticketId },
    data: { assignedToId: newAssigneeId, status: ticket.status === 'OPEN' ? 'ASSIGNED' : ticket.status },
  })

  await prisma.ticketHistory.create({
    data: {
      ticketId,
      userId: session.userId,
      action: `Ticket reassigned to ${newAssignee.name} by Admin`,
    },
  })

  revalidatePath('/tickets')
  revalidatePath(`/tickets/${ticketId}`)
  return {}
}

export async function takeOverTicket(ticketId: string): Promise<{ error?: string }> {
  const session = await getSession()
  if (!session || session.role !== 'IT_SUPPORT') {
    return { error: 'Unauthorized: Only IT Support can take over tickets.' }
  }

  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: { assignedTo: { select: { id: true, name: true } } },
  })
  if (!ticket) return { error: 'Ticket not found.' }

  if (ticket.assignedToId === session.userId) {
    return { error: 'This ticket is already assigned to you.' }
  }

  const previousAgentName = ticket.assignedTo?.name || 'Unassigned'
  const newStatus = ticket.status === 'OPEN' ? 'ASSIGNED' : (ticket.status as Status)

  await prisma.ticket.update({
    where: { id: ticketId },
    data: {
      assignedToId: session.userId,
      status: newStatus,
    },
  })

  await prisma.ticketHistory.create({
    data: {
      ticketId,
      userId: session.userId,
      action: `Ticket taken over by ${session.name} (reassigned from ${previousAgentName})`,
    },
  })

  revalidatePath('/tickets')
  revalidatePath(`/tickets/${ticketId}`)
  return {}
}

export async function assignTicket(
  ticketId: string,
  assigneeId: string,
): Promise<{ error?: string }> {
  const session = await getSession()
  if (!session || session.role !== 'IT_SUPPORT') {
    return { error: 'Unauthorized: Only IT Support can assign tickets.' }
  }

  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } })
  if (!ticket) return { error: 'Ticket not found.' }

  const currentStatus = ticket.status as Status

  // Allow reassignment even on IN_PROGRESS tickets
  if (currentStatus === 'RESOLVED' || currentStatus === 'CLOSED') {
    return { error: `Cannot reassign a ticket in ${currentStatus} status.` }
  }

  const assignee = await prisma.user.findUnique({ where: { id: assigneeId } })
  if (!assignee) return { error: 'Assignee not found.' }

  const previousAgent = ticket.assignedToId
    ? await prisma.user.findUnique({
        where: { id: ticket.assignedToId },
        select: { name: true },
      })
    : null

  await prisma.ticket.update({
    where: { id: ticketId },
    data: {
      assignedToId: assigneeId,
      status: currentStatus === 'OPEN' ? 'ASSIGNED' : currentStatus,
    },
  })

  const actionMessage = previousAgent
    ? `Reassigned from ${previousAgent.name} to ${assignee.name} by ${session.name}`
    : `Ticket assigned to ${assignee.name} by ${session.name} (status: OPEN → ASSIGNED)`

  await prisma.ticketHistory.create({
    data: {
      ticketId,
      userId: session.userId,
      action: actionMessage,
    },
  })

  revalidatePath('/tickets')
  revalidatePath(`/tickets/${ticketId}`)
  return {}
}

export async function updateTicketPriority(ticketId: string, priority: Priority): Promise<{ error?: string }> {
  const session = await getSession()
  if (!session || session.role !== 'IT_SUPPORT') {
    return { error: 'Unauthorized: Only IT Support can update ticket priority.' }
  }

  await prisma.ticket.update({
    where: { id: ticketId },
    data: { priority },
  })

  await prisma.ticketHistory.create({
    data: {
      ticketId,
      userId: session.userId,
      action: `Priority updated to ${priority}`,
    },
  })

  revalidatePath('/tickets')
  revalidatePath(`/tickets/${ticketId}`)
  return {}
}

export async function addComment(ticketId: string, content: string, isInternal: boolean = false): Promise<{ error?: string }> {
  const session = await getSession()
  if (!session) redirect('/login')

  if (!content.trim()) return { error: 'Comment cannot be empty.' }

  let finalIsInternal = isInternal

  // EMPLOYEE can only comment on tickets they created
  if (session.role === 'EMPLOYEE') {
    finalIsInternal = false
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { createdById: true },
    })
    if (!ticket) return { error: 'Ticket not found.' }
    if (ticket.createdById !== session.userId) {
      return { error: 'Forbidden: You can only comment on your own tickets.' }
    }
  }

  await prisma.comment.create({
    data: {
      content: content.trim(),
      ticketId,
      authorId: session.userId,
      isInternal: finalIsInternal,
    },
  })

  await prisma.ticketHistory.create({
    data: {
      ticketId,
      userId: session.userId,
      action: `Comment added by ${session.name}`,
    },
  })

  revalidatePath(`/tickets/${ticketId}`)
  return {}
}

/**
 * Toggle the current IT Support agent's availability status.
 * Returns the new availability value.
 */
export async function toggleAvailability(): Promise<{ isAvailable: boolean; error?: string }> {
  const session = await getSession()
  if (!session || session.role !== 'IT_SUPPORT') {
    return { isAvailable: false, error: 'Unauthorized' }
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { isAvailable: true },
  })

  if (!user) return { isAvailable: false, error: 'User not found.' }

  const newValue = !user.isAvailable

  await prisma.user.update({
    where: { id: session.userId },
    data: { isAvailable: newValue },
  })

  revalidatePath('/tickets')
  return { isAvailable: newValue }
}

/**
 * Get the current agent's availability status.
 */
export async function getMyAvailability(): Promise<{ isAvailable: boolean }> {
  const session = await getSession()
  if (!session || session.role !== 'IT_SUPPORT') return { isAvailable: false }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { isAvailable: true },
  })

  return { isAvailable: user?.isAvailable ?? true }
}

export async function getTicketDetails(id: string) {
  const session = await getSession()
  if (!session) throw new Error('Unauthorized')
  
  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
      assignedTo: { select: { id: true, name: true, email: true } },
      comments: {
        where: session.role === 'EMPLOYEE' ? { isInternal: false } : undefined,
        include: { author: { select: { name: true, role: true } } },
        orderBy: { createdAt: 'asc' }
      },
      ticketHistories: {
        include: { user: { select: { name: true } } },
        orderBy: { createdAt: 'asc' }
      }
    }
  })
  if (!ticket) return null

  if (session.role === 'EMPLOYEE' && ticket?.createdById !== session.userId) {
    return null
  }

  return ticket
}

export async function confirmTicketResolution(ticketId: string): Promise<{ error?: string }> {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }
  
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } })
  if (!ticket) return { error: 'Ticket not found' }
  
  if (session.userId !== ticket.createdById) {
    return { error: 'Forbidden: Only the ticket requester can confirm resolution.' }
  }
  if (ticket.status !== 'RESOLVED') {
    return { error: 'Ticket must be in RESOLVED state to confirm.' }
  }

  await prisma.ticket.update({
    where: { id: ticketId },
    data: {
      status: 'CLOSED',
      ...statusChangeFields(ticket, 'CLOSED'),
    }
  })

  await prisma.ticketHistory.create({
    data: {
      ticketId,
      userId: session.userId,
      action: 'Resolution confirmed by requester. Ticket closed.',
    }
  })

  revalidatePath(`/tickets/${ticketId}`)
  revalidatePath('/tickets')
  return {}
}

export async function reopenTicket(ticketId: string, reason: string): Promise<{ error?: string }> {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }

  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } })
  if (!ticket) return { error: 'Ticket not found' }
  
  if (session.userId !== ticket.createdById) {
    return { error: 'Forbidden: Only the ticket requester can reopen it.' }
  }
  if (ticket.status !== 'RESOLVED' && ticket.status !== 'CLOSED') {
    return { error: 'Only RESOLVED or CLOSED tickets can be reopened.' }
  }
  if (!reason || reason.trim().length < 5) {
    return { error: 'A valid reason (min 5 chars) is required to reopen.' }
  }

  const newStatus = ticket.assignedToId ? 'IN_PROGRESS' : 'OPEN'

  await prisma.ticket.update({
    where: { id: ticketId },
    data: {
      status: newStatus,
      ...statusChangeFields(ticket, newStatus),
    }
  })

  await prisma.ticketHistory.create({
    data: {
      ticketId,
      userId: session.userId,
      action: `Ticket reopened by requester. Reason: ${reason}`,
    }
  })

  revalidatePath(`/tickets/${ticketId}`)
  revalidatePath('/tickets')
  return {}
}

export async function submitCsatRating(ticketId: string, rating: number, feedback: string = ''): Promise<{ error?: string }> {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }

  if (rating < 1 || rating > 5) {
    return { error: 'Rating must be between 1 and 5 stars.' }
  }

  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } })
  if (!ticket) return { error: 'Ticket not found' }
  
  if (session.userId !== ticket.createdById) {
    return { error: 'Forbidden: Only the ticket requester can submit a CSAT rating.' }
  }

  await prisma.ticket.update({
    where: { id: ticketId },
    data: {
      csatRating: rating,
      csatFeedback: feedback.trim()
    }
  })

  await prisma.ticketHistory.create({
    data: {
      ticketId,
      userId: session.userId,
      action: `CSAT Rating submitted: ${rating} Stars`,
    }
  })

  revalidatePath(`/tickets/${ticketId}`)
  return {}
}

