'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Filter, Search, X, XCircle } from 'lucide-react'
import { TICKET_CATEGORIES } from '@/lib/constants'
import { useTranslation, getStatusLabel, getPriorityLabel, getCategoryLabel } from '@/lib/i18n'
import type { DateRange, TicketFilterState } from './useTicketFilters'
import type { TicketListStats } from '@/lib/ticket-query'
import { ACTIVE_PILL } from './types'

const STATUS_VALUES = ['', 'OPEN', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']
const PRIORITY_VALUES = ['', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW']
const DATE_RANGES: { value: DateRange; label: string }[] = [
  { value: 'all', label: 'ticketList.rangeAll' },
  { value: 'today', label: 'ticketList.rangeToday' },
  { value: 'week', label: 'ticketList.rangeWeek' },
  { value: 'month', label: 'ticketList.rangeMonth' },
]

/** Search box, status pills, and the expandable priority/category/agent/date filters */
export default function TicketFilters({
  filters: f,
  stats,
  agents,
  showAgentFilter,
}: {
  filters: TicketFilterState
  /** Counts for the whole queue, shown on the status pills */
  stats: TicketListStats
  agents?: { id: string; name: string }[]
  showAgentFilter?: boolean
}) {
  const { t, locale } = useTranslation()
  const [showFilters, setShowFilters] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Ctrl/Cmd+K or "/" focuses the search box
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const typing = document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLTextAreaElement
      if (((e.metaKey || e.ctrlKey) && e.key === 'k') || (e.key === '/' && !typing)) {
        e.preventDefault()
        searchInputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const pill = (key: string, active: boolean, onClick: () => void, label: React.ReactNode, className = 'filter-pill') => (
    <button key={key} type="button" onClick={onClick} className={className} style={active ? ACTIVE_PILL : undefined}>
      {label}
    </button>
  )

  const section = (title: string, children: React.ReactNode) => (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-primary)' }}>{title}</p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  )

  return (
    <div className="space-y-3">
      {/* Search + filter toggle */}
      <div className="flex items-center gap-3">
        <div
          className="relative flex items-center flex-1"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '0 12px', transition: 'border-color 0.15s' }}
        >
          <Search className="w-4 h-4 shrink-0 mr-3 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
          <input
            ref={searchInputRef}
            type="text"
            value={f.search}
            onChange={(e) => f.setSearch(e.target.value)}
            placeholder={t('ticketList.searchByTitleTicketId')}
            aria-label={t('ticketList.searchByTitleTicketId')}
            className="w-full bg-transparent text-sm outline-none border-0 ring-0 py-2.5"
            style={{ color: 'var(--text-primary)' }}
          />
          {f.search && (
            <button type="button" onClick={() => f.setSearch('')} className="p-1 rounded cursor-pointer" style={{ color: 'var(--text-muted)' }}>
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={() => setShowFilters((s) => !s)}
          className="btn btn-secondary btn-sm gap-2 relative"
          style={{
            background: showFilters ? 'var(--brand-muted)' : undefined,
            borderColor: showFilters ? 'var(--border-focus)' : undefined,
            color: showFilters ? 'var(--brand)' : undefined,
          }}
        >
          <Filter className="w-3.5 h-3.5" />
          {t('ticketList.filters')}
          {f.activeCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full text-[10px] font-bold flex items-center justify-center text-foreground" style={{ background: 'var(--brand)' }}>
              {f.activeCount}
            </span>
          )}
        </button>
        {f.activeCount > 0 && (
          <button type="button" onClick={f.clearAll} className="btn btn-ghost btn-sm" style={{ color: 'var(--text-muted)' }}>
            <XCircle className="w-3.5 h-3.5" />
            {t('ticketList.clear')}
          </button>
        )}
      </div>

      {/* Status pills (always visible) */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
        {STATUS_VALUES.map((value) => {
          const count = value ? stats.byStatus[value as keyof TicketListStats['byStatus']] : stats.total
          const isActive = f.statusFilter === value
          const highlighted = value === '' ? f.statusFilter === '' : f.statusFilter.split(',').includes(value)
          return (
            <button key={value} type="button" onClick={() => f.setStatusFilter(value)} className="filter-pill" style={highlighted ? ACTIVE_PILL : undefined}>
              {value ? getStatusLabel(value, locale) : t('ticketList.all')}
              <span
                className="text-[10px] font-mono px-1 py-0.5 rounded-full"
                style={{ background: isActive ? 'var(--bg-hover)' : 'var(--bg-overlay)', color: isActive ? 'var(--brand)' : 'var(--text-muted)' }}
              >
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Expanded filters */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="rounded-xl p-4 space-y-3" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
              {section(
                t('common.priority'),
                PRIORITY_VALUES.map((value) =>
                  pill(value, f.priorityFilter === value, () => f.setPriorityFilter(value), value ? getPriorityLabel(value, locale) : t('ticketList.all')),
                ),
              )}

              {section(t('common.category'), [
                pill('', !f.categoryFilter, () => f.setCategoryFilter(''), t('ticketList.all')),
                ...TICKET_CATEGORIES.map((cat) => pill(cat, f.categoryFilter === cat, () => f.setCategoryFilter(cat), getCategoryLabel(cat, locale))),
              ])}

              {showAgentFilter && agents && agents.length > 0 &&
                section(t('ticketList.assignedAgent'), [
                  pill('', !f.agentFilter, () => f.setAgentFilter(''), t('ticketList.all')),
                  pill('unassigned', f.agentFilter === 'unassigned', () => f.setAgentFilter('unassigned'), t('ticketList.unassigned')),
                  ...agents.map((ag) => pill(ag.id, f.agentFilter === ag.id, () => f.setAgentFilter(ag.id), ag.name)),
                ])}

              {section(
                t('ticketList.dateRange'),
                DATE_RANGES.map((range) =>
                  pill(range.value, f.dateRangeFilter === range.value, () => f.setDateRangeFilter(range.value), t(range.label), 'filter-pill capitalize'),
                ),
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
