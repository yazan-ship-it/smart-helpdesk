'use client'

import { useState, useEffect, useMemo, Suspense } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { motion, AnimatePresence, type Variants } from 'framer-motion'
import { AlertTriangle, Inbox, Plus, Sparkles } from 'lucide-react'
import EmptyState from '@/app/components/EmptyState'
import TicketDrawer from '@/app/components/TicketDrawer'
import type { CannedResponse } from '@/lib/settings'
import { useTranslation } from '@/lib/i18n'
import { ListHeader, QueueTabs } from './_parts/ListHeader'
import StatsOverview, { ticketStats } from './_parts/StatsOverview'
import TicketFilters from './_parts/TicketFilters'
import { EmployeeTicketCard, StaffTicketRow } from './_parts/TicketItems'
import { useTicketFilters } from './_parts/useTicketFilters'
import type { Role, TicketData } from './_parts/types'

export type { TicketData }

type Props = {
  tickets: TicketData[]
  role: Role
  currentUserId?: string
  totalTicketCount?: number
  assignedToMeCount?: number
  activeQueue?: 'assigned_to_me' | 'all'
  agents?: { id: string; name: string }[]
  /** Admin-defined quick replies, offered in the ticket drawer */
  cannedResponses?: CannedResponse[]
  isAdminView?: boolean
  /** Admin "SLA breaches" view: the server already filtered the tickets */
  slaBreachedOnly?: boolean
}

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.04 } },
}

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.2, ease: 'easeOut' } },
}

/** Ticket list for every role: employees see cards, staff a queue that opens a drawer */
function TicketListClientContent({ tickets, role, currentUserId, totalTicketCount, assignedToMeCount, activeQueue, agents, cannedResponses = [], isAdminView, slaBreachedOnly }: Props) {
  const { t } = useTranslation()
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const filters = useTicketFilters(tickets, currentUserId, activeQueue)
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null)
  const criticalCount = useMemo(() => ticketStats(tickets).critical, [tickets])

  // Keep the queue current: re-fetch the server data every 30s while the tab is visible
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') router.refresh()
    }, 30_000)
    return () => clearInterval(id)
  }, [router])

  // After creating a ticket the form redirects here with ?created=true
  useEffect(() => {
    if (searchParams?.get('created') === 'true') {
      toast.success(t('toasts.ticketCreated'))
      router.replace(pathname || '/tickets')
    }
  }, [searchParams, pathname, router, t])

  // Tell an IT agent once about critical tickets assigned to them
  useEffect(() => {
    if (role !== 'IT_SUPPORT' || !currentUserId) return
    const myCritical = tickets.filter(
      (ticket) => ticket.priority === 'CRITICAL' && ticket.assignedToId === currentUserId && ticket.status !== 'RESOLVED' && ticket.status !== 'CLOSED',
    )
    if (myCritical.length > 0) {
      toast.error(t('toasts.criticalAssigned', { count: myCritical.length }), { duration: 6000, id: 'critical-alert' })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // once, on mount

  // "Showing {shown} of {total} tickets", with the shown count highlighted
  const [showingBefore, showingAfter] = t('ticketList.showingOf', { total: tickets.length }).split('{shown}')

  return (
    <div className="animate-fade-up">
      <ListHeader role={role} isAdminView={isAdminView} criticalCount={criticalCount} />

      <div className="page-content space-y-6">
        {slaBreachedOnly && (
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl border border-red-500/30 bg-red-500/5 text-sm">
            <span className="flex items-center gap-2 text-red-700 dark:text-red-300 font-medium">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {t('tickets.slaBreachedOnly')}
            </span>
            <Link href="/admin/tickets" className="text-xs font-semibold underline">
              {t('tickets.showAllTickets')}
            </Link>
          </div>
        )}

        {role === 'IT_SUPPORT' && (
          <QueueTabs
            activeQueue={activeQueue}
            assignedCount={assignedToMeCount ?? tickets.filter((ticket) => ticket.assignedToId === currentUserId).length}
            totalCount={totalTicketCount ?? tickets.length}
          />
        )}

        <StatsOverview tickets={tickets} role={role} />

        <TicketFilters filters={filters} tickets={tickets} agents={agents} showAgentFilter={isAdminView} />

        <div className="flex items-center justify-between">
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {showingBefore}
            <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{filters.filtered.length}</span>
            {showingAfter}
          </p>
        </div>

        {filters.filtered.length === 0 ? (
          role === 'EMPLOYEE' && !filters.hasUserFilters ? (
            <div className="flex flex-col items-center justify-center p-12 text-center rounded-2xl border border-border bg-card shadow-sm animate-fade-in mt-4">
              <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 flex items-center justify-center mb-5">
                <Sparkles className="w-8 h-8 text-indigo-500" />
              </div>
              <h3 className="text-2xl font-bold text-foreground mb-2">{t('ticketList.allSystemsOperational')}</h3>
              <p className="text-base text-muted-foreground max-w-md mb-8">{t('ticketList.youDonTHaveAny')}</p>
              <Link href="/tickets/new" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition-colors shadow-sm">
                <Plus className="w-5 h-5" />
                {t('tickets.createNew')}
              </Link>
            </div>
          ) : (
            <EmptyState
              title={filters.hasUserFilters ? t('ticketList.noTicketsMatchYourActive') : t('ticketList.noTicketsInThisQueue')}
              description={filters.hasUserFilters ? t('ticketList.tryClearingFiltersOrAdjusting') : t('ticketList.allEnterpriseIssuesHaveBeen')}
              icon={<Inbox className="w-8 h-8 text-[var(--text-muted)]" />}
            >
              {filters.hasUserFilters && (
                <button type="button" onClick={filters.clearAll} className="btn btn-secondary btn-sm inline-flex">
                  {t('ticketList.clearAllFilters')}
                </button>
              )}
            </EmptyState>
          )
        ) : (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className={role === 'EMPLOYEE' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4' : 'space-y-2'}
          >
            <AnimatePresence mode="popLayout">
              {filters.filtered.map((ticket) => (
                <motion.div
                  key={ticket.id}
                  variants={itemVariants}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                >
                  {role === 'EMPLOYEE' ? (
                    <EmployeeTicketCard ticket={ticket} />
                  ) : (
                    <StaffTicketRow ticket={ticket} onOpen={() => setSelectedTicketId(ticket.id)} />
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </div>
      <TicketDrawer
        ticketId={selectedTicketId}
        isOpen={!!selectedTicketId}
        onClose={() => setSelectedTicketId(null)}
        currentUserId={currentUserId || ''}
        canChangeTickets={role === 'IT_SUPPORT'}
        cannedResponses={cannedResponses}
      />
    </div>
  )
}

export default function TicketListClient(props: Props) {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-muted-foreground">…</div>}>
      <TicketListClientContent {...props} />
    </Suspense>
  )
}
