'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/session'
import { resolveAutoAssignment, type DispatchResult } from '@/lib/services/assignment'
import { slaDeadlineFor, statusChangeFields } from '@/lib/sla'
import { historyData } from '@/lib/history'
import { PRIORITIES, type Priority } from '@/lib/ai/triage'
import { parseCategories } from '@/lib/settings'
import { MAX_FILES } from '@/lib/uploads'
import { isValidTransition, type Status } from '@/lib/ticket-status'
import { fail, type ActionResult, type ErrorCode } from '@/lib/errors'
import { COMMENT_MAX, CSAT_FEEDBACK_MAX, DESCRIPTION_MAX, DESCRIPTION_MIN, TITLE_MAX, TITLE_MIN } from '@/lib/ticket-rules'

export type { Priority }
export type { Status }


export type TicketState = {
  error?: ErrorCode
  /** The form shows newTicket.errors.<field> for each flagged field */
  fieldErrors?: Partial<Record<'title' | 'description' | 'category', true>>
} | undefined

const isFinished = (status: string) => status === 'RESOLVED' || status === 'CLOSED'

/** Only active IT support staff can be given tickets */
async function findAssignee(userId: string) {
  return prisma.user.findFirst({
    where: { id: userId, role: 'IT_SUPPORT', accountStatus: 'APPROVED' },
    select: { id: true, name: true },
  })
}

class InvalidAttachmentsError extends Error {}

/** A JSON list of distinct ids, at most MAX_FILES; null if malformed */
function parseIdList(value: FormDataEntryValue | null): string[] | null {
  if (value === null || value === '') return []
  try {
    const ids: unknown = JSON.parse(String(value))
    if (!Array.isArray(ids) || ids.length > MAX_FILES || !ids.every((id) => typeof id === 'string' && id.length <= 64)) return null
    return new Set(ids).size === ids.length ? (ids as string[]) : null
  } catch {
    return null
  }
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

  // Ids of files this user uploaded for this ticket (POST /api/upload)
  const attachmentIds = parseIdList(formData.get('attachmentIds'))
  if (!attachmentIds) return { error: 'invalid_attachments' }

  // Skill-based auto-dispatch is an admin policy (Settings → auto-assignment), not the requester's choice
  let dispatch: DispatchResult = { assigned: false, assignedToId: null, status: 'OPEN' }
  if (settings?.autoAssignmentEnabled ?? true) {
    dispatch = await resolveAutoAssignment(category)
  }

  const slaDeadline = slaDeadlineFor(priority, settings)

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
            slaDeadline,
            createdById: session.userId,
          },
        })

        // Only the requester's own uploads that don't belong to a ticket yet
        if (attachmentIds.length > 0) {
          const { count } = await tx.attachment.updateMany({
            where: { id: { in: attachmentIds }, uploadedById: session.userId, ticketId: null },
            data: { ticketId: ticket.id },
          })
          if (count !== attachmentIds.length) throw new InvalidAttachmentsError()
        }

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
      if (err instanceof InvalidAttachmentsError) return { error: 'invalid_attachments' }
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
  const settings = await prisma.appSettings.findUnique({ where: { id: 'singleton' } })

  await prisma.ticket.update({
    where: { id: ticketId },
    data: {
      status: newStatus,
      ...statusChangeFields(ticket, newStatus),
      // The reopened work gets a fresh deadline; an earlier breach stays recorded
      slaDeadline: slaDeadlineFor(ticket.priority, settings),
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
