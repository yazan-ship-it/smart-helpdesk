'use client'

import { useState, useEffect, Suspense } from 'react'
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
import StatsOverview from './_parts/StatsOverview'
import TicketFilters from './_parts/TicketFilters'
import { EmployeeTicketCard, StaffTicketRow } from './_parts/TicketItems'
import { useTicketFilters } from './_parts/useTicketFilters'
import Pagination from './_parts/Pagination'
import type { TicketListStats } from '@/lib/ticket-query'
import type { Role, TicketData } from './_parts/types'

export type { TicketData }

type Props = {
  /** One page of tickets, already filtered and sorted by the server */
  tickets: TicketData[]
  /** How many tickets match the filters, on all pages */
  matching: number
  page: number
  pageCount: number
  /** Counts for the whole queue (counters, chart, status pills) */
  stats: TicketListStats
  /** Unfinished critical tickets assigned to this agent */
  myCriticalCount?: number
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
function TicketListClientContent({ tickets, matching, page, pageCount, stats, myCriticalCount = 0, role, currentUserId, totalTicketCount, assignedToMeCount, activeQueue, agents, cannedResponses = [], isAdminView, slaBreachedOnly }: Props) {
  const { t } = useTranslation()
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const filters = useTicketFilters()
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null)

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
    if (role !== 'IT_SUPPORT' || myCriticalCount === 0) return
    toast.error(t('toasts.criticalAssigned', { count: myCriticalCount }), { duration: 6000, id: 'critical-alert' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // once, on mount

  // "Showing {shown} of {total} tickets", with the shown count highlighted
  const [showingBefore, showingAfter] = t('ticketList.showingOf', { total: stats.total }).split('{shown}')

  return (
    <div className="animate-fade-up">
      <ListHeader role={role} isAdminView={isAdminView} criticalCount={stats.critical} />

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
            assignedCount={assignedToMeCount ?? 0}
            totalCount={totalTicketCount ?? stats.total}
          />
        )}

        <StatsOverview stats={stats} role={role} />

        <TicketFilters filters={filters} stats={stats} agents={agents} showAgentFilter={isAdminView} />

        <div className="flex items-center justify-between">
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {showingBefore}
            <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{matching}</span>
            {showingAfter}
          </p>
        </div>

        {tickets.length === 0 ? (
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
            className={`${role === 'EMPLOYEE' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4' : 'space-y-2'} transition-opacity ${filters.isPending ? 'opacity-60' : ''}`}
            aria-busy={filters.isPending}
          >
            <AnimatePresence mode="popLayout">
              {tickets.map((ticket) => (
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

        <Pagination page={page} pageCount={pageCount} onPage={filters.goToPage} disabled={filters.isPending} />
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
