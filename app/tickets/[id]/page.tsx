import { notFound } from 'next/navigation'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/db'
import { toAttachmentInfo } from '@/lib/uploads'
import { getAppSettings, parseCannedResponses } from '@/lib/settings'
import TicketDetailClient, { type TicketDetailData } from './TicketDetailClient'
import type { Metadata } from 'next'
import { formatTicketNumber } from '@/lib/utils'

// Only the ticket number, so the tab title never reveals ticket content
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const ticket = await prisma.ticket.findUnique({ where: { id }, select: { ticketNumber: true } })
  return { title: ticket ? `#${formatTicketNumber(ticket.ticketNumber)}` : 'Ticket' }
}

export default async function TicketDetailPage({
 params,
}: {
 params: Promise<{ id: string }>
}) {
 const { id } = await params
 const session = await getSession()
 if (!session) return null

 const isStaff = session.role === 'IT_SUPPORT' || session.role === 'ADMIN'

 // The ticket, the agents to assign it to and the settings, in one round trip
 const [ticket, itAgents, settings] = await Promise.all([
 prisma.ticket.findUnique({
 where: { id },
 include: {
 createdBy: { select: { id: true, name: true, email: true } },
 assignedTo: { select: { id: true, name: true } },
 comments: {
 where: session.role === 'EMPLOYEE' ? { isInternal: false } : undefined,
 include: { author: { select: { name: true, role: true } } },
 orderBy: { createdAt: 'asc' },
 },
 ticketHistories: {
 include: { user: { select: { name: true } } },
 orderBy: { createdAt: 'asc' },
 },
 attachments: { select: { id: true, name: true, size: true, type: true }, orderBy: { createdAt: 'asc' } },
 },
 }),
 isStaff
 ? prisma.user.findMany({
 where: { role: 'IT_SUPPORT', accountStatus: 'APPROVED' },
 select: { id: true, name: true, skills: true, isAvailable: true },
 })
 : Promise.resolve([]),
 getAppSettings(),
 ])

 if (!ticket) notFound()

 // If role is EMPLOYEE, verify they created this ticket
 if (session.role === 'EMPLOYEE' && ticket.createdById !== session.userId) {
 notFound()
 }

 const cannedResponses = parseCannedResponses(settings?.cannedResponses)

 const serializedTicket: TicketDetailData = {
 id: ticket.id,
 ticketNumber: ticket.ticketNumber,
 title: ticket.title,
 description: ticket.description,
 category: ticket.category,
 priority: ticket.priority as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
 status: ticket.status as 'OPEN' | 'ASSIGNED' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED',
 attachments: ticket.attachments.map(toAttachmentInfo),
 slaDeadline: ticket.slaDeadline?.toISOString() || null,
 slaBreached: ticket.slaBreached,
 csatRating: ticket.csatRating,
 csatFeedback: ticket.csatFeedback,
 resolvedAt: ticket.resolvedAt?.toISOString() || null,
 closedAt: ticket.closedAt?.toISOString() || null,
 createdAt: ticket.createdAt.toISOString(),
 updatedAt: ticket.updatedAt.toISOString(),
 createdBy: ticket.createdBy,
 assignedTo: ticket.assignedTo,
 assignedToId: ticket.assignedToId,
 comments: ticket.comments.map(c => ({
 id: c.id,
 content: c.content,
 isInternal: c.isInternal,
 createdAt: c.createdAt.toISOString(),
 author: {
 name: c.author.name,
 role: c.author.role as 'EMPLOYEE' | 'IT_SUPPORT' | 'ADMIN',
 },
 })),
 ticketHistories: ticket.ticketHistories.map(h => ({
 id: h.id,
 action: h.action,
 event: h.event,
 meta: h.meta,
 createdAt: h.createdAt.toISOString(),
 user: h.user,
 })),
 }

 return (
 <TicketDetailClient
 ticket={serializedTicket}
 itAgents={itAgents}
 cannedResponses={cannedResponses}
 currentUserId={session.userId}
 currentUserRole={session.role as 'EMPLOYEE' | 'IT_SUPPORT' | 'ADMIN'}
 />
 )
}
