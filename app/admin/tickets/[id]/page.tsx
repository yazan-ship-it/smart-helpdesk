import { notFound, redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/db'
import TicketDetailClient, { type TicketDetailData } from '@/app/tickets/[id]/TicketDetailClient'

export default async function AdminTicketDetailPage({
 params,
}: {
 params: Promise<{ id: string }>
}) {
 const { id } = await params
 const session = await getSession()
 if (!session || session.role !== 'ADMIN') {
   redirect('/login')
 }

 const ticket = await prisma.ticket.findUnique({
 where: { id },
 include: {
 createdBy: { select: { id: true, name: true, email: true } },
 assignedTo: { select: { id: true, name: true } },
 comments: {
 include: { author: { select: { name: true, role: true } } },
 orderBy: { createdAt: 'asc' },
 },
 ticketHistories: {
 include: { user: { select: { name: true } } },
 orderBy: { createdAt: 'asc' },
 },
 },
 })

 if (!ticket) notFound()

 const itAgents = await prisma.user.findMany({
   where: { role: 'IT_SUPPORT', accountStatus: 'APPROVED' },
   select: { id: true, name: true, skills: true, isAvailable: true },
 })

 const settings = await prisma.appSettings.findUnique({ where: { id: 'singleton' } })
 const cannedResponses = settings?.cannedResponses 
   ? JSON.parse(settings.cannedResponses) 
   : []

 const serializedTicket: TicketDetailData = {
 id: ticket.id,
 ticketNumber: ticket.ticketNumber,
 title: ticket.title,
 description: ticket.description,
 category: ticket.category,
 priority: ticket.priority as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
 status: ticket.status as 'OPEN' | 'ASSIGNED' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED',
 attachments: ticket.attachments,
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
 currentUserRole="ADMIN"
 />
 )
}
