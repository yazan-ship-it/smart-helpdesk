import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/db'
import { getAppSettings, parseCannedResponses } from '@/lib/settings'
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

  const tickets = await prisma.ticket.findMany({
    where: isAdmin 
      ? {} 
      : isITSupport
        ? (isAssignedToMeQueue ? { assignedToId: session.userId } : {})
        : { createdById: session.userId },
    include: {
      createdBy: { select: { name: true } },
      assignedTo: { select: { name: true } },
      _count: { select: { comments: true, attachments: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  // Global counts for IT Support queue tabs
  let totalTicketCount = 0
  let assignedToMeCount = 0
  if (isITSupport || isAdmin) {
    [totalTicketCount, assignedToMeCount] = await Promise.all([
      prisma.ticket.count(),
      prisma.ticket.count({ where: { assignedToId: session.userId } }),
    ])
  }

  let agents: { id: string; name: string }[] = []
  if (isITSupport || isAdmin) {
    agents = await prisma.user.findMany({
      where: { role: 'IT_SUPPORT', accountStatus: 'APPROVED' },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    })
  }

  const serialized = tickets.map((t) => ({
    ...t,
    priority: t.priority as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
    status: t.status as 'OPEN' | 'ASSIGNED' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED',
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
    slaDeadline: t.slaDeadline ? t.slaDeadline.toISOString() : undefined,
  }))

  return (
    <TicketListClient
      tickets={serialized}
      role={session.role as 'EMPLOYEE' | 'IT_SUPPORT' | 'ADMIN'}
      currentUserId={session.userId}
      totalTicketCount={totalTicketCount}
      assignedToMeCount={assignedToMeCount}
      activeQueue={isAssignedToMeQueue ? 'assigned_to_me' : (searchParams?.queue === 'all' ? 'all' : undefined)}
      agents={agents}
      cannedResponses={parseCannedResponses((await getAppSettings())?.cannedResponses)}
    />
  )
}
