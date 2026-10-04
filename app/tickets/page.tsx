import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/db'
import { getAppSettings, parseCannedResponses } from '@/lib/settings'
import { loadTicketPage, parseTicketFilters } from '@/lib/ticket-query'
import TicketListClient from './TicketListClient'

export const metadata = { title: 'Tickets' }

export default async function TicketsPage(props: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const searchParams = await props.searchParams
  const session = await getSession()
  if (!session) return null

  const isITSupport = session.role === 'IT_SUPPORT'
  const isAdmin = session.role === 'ADMIN'

  // Default Landing Queue for IT Support:
  // When an IT Support agent navigates to /tickets without explicit query parameters,
  // default the view to queue=assigned_to_me instead of showing all tickets.
  if (isITSupport && (!searchParams || Object.keys(searchParams).length === 0)) {
    redirect('/tickets?queue=assigned_to_me')
  }

  const isAssignedToMeQueue =
    searchParams?.queue === 'assigned_to_me' ||
    searchParams?.assignedToMe === 'true'

  // Whose tickets this user may see in this queue; the URL's filters narrow it further
  const scope = isAdmin
    ? {}
    : isITSupport
      ? (isAssignedToMeQueue ? { assignedToId: session.userId } : {})
      : { createdById: session.userId }

  const isStaff = isITSupport || isAdmin
  const [list, counts, agents, myCriticalCount, settings] = await Promise.all([
    loadTicketPage(scope, parseTicketFilters(searchParams)),
    // Global counts for IT Support queue tabs
    isStaff
      ? Promise.all([prisma.ticket.count(), prisma.ticket.count({ where: { assignedToId: session.userId } })])
      : Promise.resolve([0, 0]),
    isStaff
      ? prisma.user.findMany({
          where: { role: 'IT_SUPPORT', accountStatus: 'APPROVED' },
          select: { id: true, name: true },
          orderBy: { name: 'asc' },
        })
      : Promise.resolve([]),
    // An agent is told once about unfinished critical tickets assigned to them
    isITSupport
      ? prisma.ticket.count({ where: { assignedToId: session.userId, priority: 'CRITICAL', status: { notIn: ['RESOLVED', 'CLOSED'] } } })
      : Promise.resolve(0),
    getAppSettings(),
  ])
  const [totalTicketCount, assignedToMeCount] = counts

  return (
    <TicketListClient
      tickets={list.tickets}
      matching={list.matching}
      page={list.page}
      pageCount={list.pageCount}
      stats={list.stats}
      myCriticalCount={myCriticalCount}
      role={session.role as 'EMPLOYEE' | 'IT_SUPPORT' | 'ADMIN'}
      currentUserId={session.userId}
      totalTicketCount={totalTicketCount}
      assignedToMeCount={assignedToMeCount}
      activeQueue={isAssignedToMeQueue ? 'assigned_to_me' : (searchParams?.queue === 'all' ? 'all' : undefined)}
      agents={agents}
      cannedResponses={parseCannedResponses(settings?.cannedResponses)}
    />
  )
}
