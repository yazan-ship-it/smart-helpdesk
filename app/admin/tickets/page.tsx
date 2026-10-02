import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/db'
import TicketListClient from '@/app/tickets/TicketListClient'
import { slaBreachedWhere } from '@/lib/sla'

export const metadata = { title: 'All Tickets | Admin' }

export default async function AdminTicketsPage(props: { searchParams: Promise<{ filter?: string }> }) {
  const { filter } = await props.searchParams
  const slaBreachedOnly = filter === 'sla_breached'
  const session = await getSession()
  
  if (!session || session.role !== 'ADMIN') {
    redirect('/login')
  }

  const tickets = await prisma.ticket.findMany({
    where: slaBreachedOnly ? slaBreachedWhere() : undefined,
    include: {
      createdBy: { select: { name: true } },
      assignedTo: { select: { name: true } },
      _count: { select: { comments: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  const agents: { id: string; name: string }[] = await prisma.user.findMany({
    where: { role: 'IT_SUPPORT', accountStatus: 'APPROVED' },
    select: { id: true, name: true },
  })

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
      role="ADMIN"
      currentUserId={session.userId}
      totalTicketCount={tickets.length}
      assignedToMeCount={0}
      activeQueue={undefined}
      agents={agents}
      isAdminView={true}
      slaBreachedOnly={slaBreachedOnly}
    />
  )
}
