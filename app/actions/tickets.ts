'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/session'
import { resolveAutoAssignment, type DispatchResult } from '@/lib/services/assignment'
import { calculateBusinessHoursDeadline, statusChangeFields } from '@/lib/sla'
import { historyData } from '@/lib/history'
import { PRIORITIES, type Priority } from '@/lib/ai/triage'
import { parseCategories } from '@/lib/settings'
import { parseAttachments } from '@/lib/uploads'
import { fail, type ActionResult, type ErrorCode } from '@/lib/errors'
import { COMMENT_MAX, CSAT_FEEDBACK_MAX, DESCRIPTION_MAX, DESCRIPTION_MIN, TITLE_MAX, TITLE_MIN } from '@/lib/ticket-rules'

export type { Priority }
export type Status = 'OPEN' | 'ASSIGNED' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED'


export type TicketState = {
  error?: ErrorCode
  /** The form shows newTicket.errors.<field> for each flagged field */
  fieldErrors?: Partial<Record<'title' | 'description' | 'category', true>>
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

const isFinished = (status: string) => status === 'RESOLVED' || status === 'CLOSED'

/** Only active IT support staff can be given tickets */
async function findAssignee(userId: string) {
  return prisma.user.findFirst({
    where: { id: userId, role: 'IT_SUPPORT', accountStatus: 'APPROVED' },
    select: { id: true, name: true },
  })
}

function isRetryableWriteConflict(err: unknown) {
  return err instanceof Prisma.PrismaClientKnownRequestError && (err.code === 'P2002' || err.code === 'P2034')
}

export async function createTicket(prevState: TicketState, formData: FormData): Promise<TicketState> {
  const session = await getSession()
  if (!session) redirect('/login')

  const title = String(formData.get('title') ?? '').trim()
  const description = String(formData.get('description') ?? '').trim()
  const category = String(formData.get('category') ?? '').trim()

  const settings = await prisma.appSettings.findUnique({ where: { id: 'singleton' } })
  if (settings?.maintenanceMode && session.role !== 'ADMIN') return { error: 'maintenance' }

  const fieldErrors: NonNullable<TicketState>['fieldErrors'] = {}
  if (title.length < TITLE_MIN || title.length > TITLE_MAX) fieldErrors.title = true
  if (description.length < DESCRIPTION_MIN || description.length > DESCRIPTION_MAX) fieldErrors.description = true
  // Only the categories the admin defined (the form's list can be edited in the browser)
  if (!parseCategories(settings?.categoriesList).includes(category)) fieldErrors.category = true
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors }

  const priority = (formData.get('priority') as Priority | null) ?? 'MEDIUM'
  if (!PRIORITIES.includes(priority)) return { error: 'invalid_priority' }

  const attachments = parseAttachments(formData.get('attachmentsJson') as string | null)
  if (!attachments) return { error: 'invalid_attachments' }

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

  // The ticket and its audit entries are written together. Two tickets created at the
  // same moment can pick the same number; the unique index rejects one, which retries.
  for (let attempt = 1; ; attempt++) {
    try {
      await prisma.$transaction(async (tx) => {
        const last = await tx.ticket.findFirst({ orderBy: { ticketNumber: 'desc' }, select: { ticketNumber: true } })
        const ticketNumber = (last?.ticketNumber ?? 0) + 1

        const ticket = await tx.ticket.create({
          data: {
            ticketNumber,
            title,
            description,
            category,
            priority,
            status: dispatch.status,
            assignedToId: dispatch.assigned ? dispatch.agentId : null,
            attachments: JSON.stringify(attachments),
            slaDeadline,
            createdById: session.userId,
          },
        })

        await tx.ticketHistory.create({
          data: { ticketId: ticket.id, userId: session.userId, ...historyData({ type: 'created', number: ticketNumber }, session.name) },
        })
        await tx.ticketHistory.create({
          data: {
            ticketId: ticket.id,
            userId: session.userId,
            ...historyData(
              dispatch.assigned
                ? { type: 'auto_assigned', agent: dispatch.agentName, category }
                : { type: 'queued_unassigned', category },
              session.name,
            ),
          },
        })
      })
      break
    } catch (err) {
      if (attempt < 5 && isRetryableWriteConflict(err)) continue
      throw err
    }
  }

  revalidatePath('/tickets')
  redirect('/tickets?created=true')
}

export async function updateTicketStatus(ticketId: string, newStatus: Status): Promise<ActionResult> {
  const session = await getSession()
  if (!session || session.role !== 'IT_SUPPORT') return fail('unauthorized')

  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: { assignedTo: { select: { id: true, name: true } } },
  })
  if (!ticket) return fail('not_found')

  // 🔒 Peer Ticket Edit Lock:
  // Agents can only modify the lifecycle status of tickets strictly assigned to their own ID,
  // or unassigned tickets they explicitly claim.
  if (ticket.assignedToId && ticket.assignedToId !== session.userId) {
    return fail('assigned_to_other', { name: ticket.assignedTo?.name ?? '' })
  }

  const currentStatus = ticket.status as Status
  if (!isValidTransition(currentStatus, newStatus)) return fail('invalid_transition')

  // If unassigned, auto-claim the ticket when changing status
  const claimed = !ticket.assignedToId

  // Only applies if nobody changed the ticket since it was read (two agents clicking at once)
  const { count } = await prisma.ticket.updateMany({
    where: { id: ticketId, status: currentStatus, assignedToId: ticket.assignedToId },
    data: {
      status: newStatus,
      ...(claimed ? { assignedToId: session.userId } : {}),
      ...statusChangeFields(ticket, newStatus),
    },
  })
  if (count === 0) return fail('stale')

  await prisma.ticketHistory.create({
    data: {
      ticketId,
      userId: session.userId,
      ...historyData({ type: 'status_changed', from: currentStatus, to: newStatus, ...(claimed ? { claimed } : {}) }, session.name),
    },
  })

  revalidatePath('/tickets')
  revalidatePath(`/tickets/${ticketId}`)
  return {}
}

export async function reassignTicket(ticketId: string, newAssigneeId: string): Promise<ActionResult> {
  const session = await getSession()
  if (!session || session.role !== 'ADMIN') return fail('unauthorized')

  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } })
  if (!ticket) return fail('not_found')
  if (isFinished(ticket.status)) return fail('ticket_closed')

  const newAssignee = await findAssignee(newAssigneeId)
  if (!newAssignee) return fail('invalid_assignee')

  await prisma.ticket.update({
    where: { id: ticketId },
    data: { assignedToId: newAssignee.id, status: ticket.status === 'OPEN' ? 'ASSIGNED' : ticket.status },
  })

  await prisma.ticketHistory.create({
    data: {
      ticketId,
      userId: session.userId,
      ...historyData({ type: 'reassigned_by_admin', agent: newAssignee.name }, session.name),
    },
  })

  revalidatePath('/tickets')
  revalidatePath(`/tickets/${ticketId}`)
  return {}
}

export async function takeOverTicket(ticketId: string): Promise<ActionResult> {
  const session = await getSession()
  if (!session || session.role !== 'IT_SUPPORT') return fail('unauthorized')

  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: { assignedTo: { select: { id: true, name: true } } },
  })
  if (!ticket) return fail('not_found')
  if (ticket.assignedToId === session.userId) return fail('already_yours')
  if (isFinished(ticket.status)) return fail('ticket_closed')

  const newStatus = ticket.status === 'OPEN' ? 'ASSIGNED' : (ticket.status as Status)

  const { count } = await prisma.ticket.updateMany({
    where: { id: ticketId, status: ticket.status, assignedToId: ticket.assignedToId },
    data: { assignedToId: session.userId, status: newStatus },
  })
  if (count === 0) return fail('stale')

  await prisma.ticketHistory.create({
    data: {
      ticketId,
      userId: session.userId,
      ...historyData({ type: 'taken_over', ...(ticket.assignedTo ? { from: ticket.assignedTo.name } : {}) }, session.name),
    },
  })

  revalidatePath('/tickets')
  revalidatePath(`/tickets/${ticketId}`)
  return {}
}

export async function assignTicket(ticketId: string, assigneeId: string): Promise<ActionResult> {
  const session = await getSession()
  if (!session || session.role !== 'IT_SUPPORT') return fail('unauthorized')

  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } })
  if (!ticket) return fail('not_found')

  const currentStatus = ticket.status as Status
  // Allow reassignment even on IN_PROGRESS tickets
  if (isFinished(currentStatus)) return fail('ticket_closed')

  const assignee = await findAssignee(assigneeId)
  if (!assignee) return fail('invalid_assignee')

  const previousAgent = ticket.assignedToId
    ? await prisma.user.findUnique({
        where: { id: ticket.assignedToId },
        select: { name: true },
      })
    : null

  await prisma.ticket.update({
    where: { id: ticketId },
    data: {
      assignedToId: assignee.id,
      status: currentStatus === 'OPEN' ? 'ASSIGNED' : currentStatus,
    },
  })

  await prisma.ticketHistory.create({
    data: {
      ticketId,
      userId: session.userId,
      ...historyData({ type: 'assigned', agent: assignee.name, ...(previousAgent ? { from: previousAgent.name } : {}) }, session.name),
    },
  })

  revalidatePath('/tickets')
  revalidatePath(`/tickets/${ticketId}`)
  return {}
}

export async function addComment(ticketId: string, content: string, isInternal: boolean = false): Promise<ActionResult> {
  const session = await getSession()
  if (!session) redirect('/login')

  const text = typeof content === 'string' ? content.trim() : ''
  if (!text) return fail('comment_empty')
  if (text.length > COMMENT_MAX) return fail('comment_too_long', { max: COMMENT_MAX })

  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId }, select: { createdById: true } })
  if (!ticket) return fail('not_found')

  // EMPLOYEE can only comment on tickets they created, and never internally
  const employee = session.role === 'EMPLOYEE'
  if (employee && ticket.createdById !== session.userId) return fail('forbidden')

  await prisma.comment.create({
    data: {
      content: text,
      ticketId,
      authorId: session.userId,
      isInternal: !employee && isInternal === true,
    },
  })

  await prisma.ticketHistory.create({
    data: {
      ticketId,
      userId: session.userId,
      ...historyData({ type: 'comment_added' }, session.name),
    },
  })

  revalidatePath(`/tickets/${ticketId}`)
  return {}
}

/**
 * Toggle the current IT Support agent's availability status.
 * Returns the new availability value.
 */
export async function toggleAvailability(): Promise<ActionResult & { isAvailable: boolean }> {
  const session = await getSession()
  if (!session || session.role !== 'IT_SUPPORT') {
    return { isAvailable: false, error: 'unauthorized' }
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { isAvailable: true },
  })

  if (!user) return { isAvailable: false, error: 'not_found' }

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

export async function confirmTicketResolution(ticketId: string): Promise<ActionResult> {
  const session = await getSession()
  if (!session) return fail('unauthorized')

  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } })
  if (!ticket) return fail('not_found')

  // Only the ticket requester can confirm resolution
  if (session.userId !== ticket.createdById) return fail('forbidden')
  if (ticket.status !== 'RESOLVED') return fail('not_resolved')

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
      ...historyData({ type: 'resolution_confirmed' }, session.name),
    }
  })

  revalidatePath(`/tickets/${ticketId}`)
  revalidatePath('/tickets')
  return {}
}

export async function reopenTicket(ticketId: string, reason: string): Promise<ActionResult> {
  const session = await getSession()
  if (!session) return fail('unauthorized')

  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } })
  if (!ticket) return fail('not_found')

  // Only the ticket requester can reopen it
  if (session.userId !== ticket.createdById) return fail('forbidden')
  if (!isFinished(ticket.status)) return fail('invalid_transition')

  const text = typeof reason === 'string' ? reason.trim() : ''
  if (text.length < 5) return fail('reason_required')
  if (text.length > COMMENT_MAX) return fail('comment_too_long', { max: COMMENT_MAX })

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
      ...historyData({ type: 'reopened', reason: text }, session.name),
    }
  })

  revalidatePath(`/tickets/${ticketId}`)
  revalidatePath('/tickets')
  return {}
}

export async function submitCsatRating(ticketId: string, rating: number, feedback: string = ''): Promise<ActionResult> {
  const session = await getSession()
  if (!session) return fail('unauthorized')

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return fail('invalid_rating')
  const text = typeof feedback === 'string' ? feedback.trim() : ''
  if (text.length > CSAT_FEEDBACK_MAX) return fail('comment_too_long', { max: CSAT_FEEDBACK_MAX })

  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } })
  if (!ticket) return fail('not_found')

  // Only the requester rates, once, after the work is done
  if (session.userId !== ticket.createdById) return fail('forbidden')
  if (!isFinished(ticket.status)) return fail('not_resolved')
  if (ticket.csatRating !== null) return fail('already_rated')

  await prisma.ticket.update({
    where: { id: ticketId },
    data: {
      csatRating: rating,
      csatFeedback: text,
    }
  })

  await prisma.ticketHistory.create({
    data: {
      ticketId,
      userId: session.userId,
      ...historyData({ type: 'csat_submitted', rating }, session.name),
    }
  })

  revalidatePath(`/tickets/${ticketId}`)
  return {}
}
