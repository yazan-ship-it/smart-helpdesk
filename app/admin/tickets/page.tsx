import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/db'
import { getAppSettings, parseCannedResponses } from '@/lib/settings'
import TicketListClient from '@/app/tickets/TicketListClient'
import { slaBreachedWhere } from '@/lib/sla'
import { loadTicketPage, parseTicketFilters } from '@/lib/ticket-query'

export const metadata = { title: 'All Tickets | Admin' }

export default async function AdminTicketsPage(props: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const searchParams = await props.searchParams
  const slaBreachedOnly = searchParams.filter === 'sla_breached'
  const session = await getSession()

  if (!session || session.role !== 'ADMIN') {
    redirect('/login')
  }

  const [list, agents, settings] = await Promise.all([
    loadTicketPage(slaBreachedOnly ? slaBreachedWhere() : {}, parseTicketFilters(searchParams)),
    prisma.user.findMany({
      where: { role: 'IT_SUPPORT', accountStatus: 'APPROVED' },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    getAppSettings(),
  ])

  return (
    <TicketListClient
      tickets={list.tickets}
      matching={list.matching}
      page={list.page}
      pageCount={list.pageCount}
      stats={list.stats}
      role="ADMIN"
      currentUserId={session.userId}
      totalTicketCount={list.stats.total}
      assignedToMeCount={0}
      activeQueue={undefined}
      agents={agents}
      cannedResponses={parseCannedResponses(settings?.cannedResponses)}
      isAdminView={true}
      slaBreachedOnly={slaBreachedOnly}
    />
  )
}
