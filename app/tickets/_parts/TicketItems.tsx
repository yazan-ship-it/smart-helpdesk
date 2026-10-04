'use client'

import Link from 'next/link'
import { ChevronRight, Clock, Layers, MessageSquare, Paperclip, User } from 'lucide-react'
import { formatRelativeTime, formatTicketNumber } from '@/lib/utils'
import { getInitials, priorityBadgeClass, statusBadgeClass } from '@/lib/ticket-display'
import { useTranslation, getStatusLabel, getPriorityLabel, getCategoryLabel } from '@/lib/i18n'
import { useNow } from '@/lib/useNow'
import type { TicketData } from './types'

const STEPS = ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']
const PRIORITY_ACCENT = { CRITICAL: '#ef4444', HIGH: '#f97316', MEDIUM: '#f59e0b', LOW: '#22c55e' } as const

const isFinished = (ticket: TicketData) => ticket.status === 'RESOLVED' || ticket.status === 'CLOSED'

/** An employee's ticket: progress, number, title, who is on it, status */
export function EmployeeTicketCard({ ticket }: { ticket: TicketData }) {
  const { t, locale } = useTranslation()
  const ticketIdx = STEPS.indexOf(ticket.status)

  return (
    <Link
      href={`/tickets/${ticket.id}`}
      className="group flex flex-col p-5 rounded-2xl transition-all duration-200 relative overflow-hidden bg-card border border-border shadow-sm hover:shadow-md hover:border-indigo-500/50 cursor-pointer h-full"
    >
      {/* Mini Stepper */}
      <div className="flex items-center gap-1 mb-4">
        {STEPS.map((step, idx) => (
          <div key={step} className="flex-1 h-1.5 rounded-full transition-colors" style={{ background: idx <= ticketIdx ? 'var(--brand)' : 'var(--border)' }} />
        ))}
      </div>

      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex flex-col gap-1.5">
          <span className="font-mono text-xs font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded-md w-fit border border-border">
            #{formatTicketNumber(ticket.ticketNumber)}
          </span>
          <h3 className="font-bold text-base text-foreground leading-tight line-clamp-2 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
            {ticket.title}
          </h3>
        </div>
      </div>

      <div className="mt-auto pt-4 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-md bg-secondary text-secondary-foreground border border-border">
            <Layers className="w-3.5 h-3.5 text-muted-foreground" />
            {getCategoryLabel(ticket.category, locale)}
          </span>
          <span className="text-xs text-muted-foreground ml-auto rtl:ml-0 rtl:mr-auto flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            <span suppressHydrationWarning>{formatRelativeTime(ticket.createdAt, locale)}</span>
          </span>
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-border/50">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-[9px] font-bold text-indigo-700 dark:text-indigo-300">
              {ticket.assignedTo ? getInitials(ticket.assignedTo.name) : '?'}
            </div>
            <span className="text-xs font-medium text-muted-foreground">
              {ticket.assignedTo ? ticket.assignedTo.name : t('ticketList.beingTriaged')}
            </span>
          </div>
          <span className={statusBadgeClass(ticket.status)}>
            <span className="badge-dot" />
            {getStatusLabel(ticket.status, locale)}
          </span>
        </div>
      </div>
    </Link>
  )
}

/** A row in the staff queue; opens the ticket in the side drawer */
export function StaffTicketRow({ ticket, onOpen }: { ticket: TicketData; onOpen: () => void }) {
  const { locale } = useTranslation()
  const urgent = ticket.priority === 'CRITICAL' && !isFinished(ticket)
  const isHighOrCritical = ticket.priority === 'CRITICAL' || ticket.priority === 'HIGH'

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      className={`group block p-4 rounded-xl transition-all duration-200 relative overflow-hidden text-start w-full ${urgent ? 'border-2 border-red-500/50 bg-red-500/5' : ''}`}
      style={{
        background: urgent ? undefined : 'var(--bg-surface)',
        border: urgent ? undefined : '1px solid var(--border)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-1px)'
        e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.08)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = ''
        e.currentTarget.style.boxShadow = ''
      }}
    >
      {/* Priority accent bar */}
      <div className="absolute start-0 top-0 bottom-0 w-[3px]" style={{ background: PRIORITY_ACCENT[ticket.priority], opacity: 0.7 }} />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 ps-2">
        {/* Requester avatar + details */}
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold text-foreground shrink-0 mt-0.5"
            style={{
              background: ticket.createdBy.name.toLowerCase().includes('bob')
                ? 'linear-gradient(135deg, var(--brand), #06b6d4)'
                : 'linear-gradient(135deg, #a78bfa, #ec4899)',
            }}
          >
            {getInitials(ticket.createdBy.name)}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="font-mono text-[11px] font-semibold px-2 py-0.5 rounded-md" style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
                #{formatTicketNumber(ticket.ticketNumber)}
              </span>
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-md" style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
                {getCategoryLabel(ticket.category, locale)}
              </span>
              <span className={`${priorityBadgeClass(ticket.priority)} text-[11px] inline-flex items-center`}>
                {isHighOrCritical && (
                  <span className="relative flex h-2 w-2 mr-1 rtl:mr-0 rtl:ml-1">
                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${ticket.priority === 'CRITICAL' ? 'bg-red-400' : 'bg-orange-400'}`} />
                    <span className={`relative inline-flex rounded-full h-2 w-2 ${ticket.priority === 'CRITICAL' ? 'bg-red-500' : 'bg-orange-500'}`} />
                  </span>
                )}
                {getPriorityLabel(ticket.priority, locale)}
              </span>
            </div>

            <h3 className="font-semibold text-sm truncate" style={{ color: 'var(--text-primary)' }}>
              {ticket.title}
            </h3>

            <div className="flex items-center gap-3 mt-1.5 text-xs flex-wrap" style={{ color: 'var(--text-muted)' }}>
              <span className="flex items-center gap-1" style={{ color: 'var(--text-secondary)' }}>
                <User className="w-3 h-3" style={{ color: 'var(--text-muted)' }} />
                {ticket.createdBy.name}
              </span>
              {ticket.assignedTo && (
                <span className="inline-flex items-center gap-1">
                  <span style={{ color: 'var(--text-primary)' }}>→</span>
                  <span className="font-medium px-1.5 py-0.5 rounded text-[11px]" style={{ color: 'var(--brand)', background: 'var(--brand-muted)', border: '1px solid var(--border-focus)' }}>
                    <span className="w-4 h-4 rounded-full bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 flex items-center justify-center text-[8px] font-bold shrink-0">
                      {getInitials(ticket.assignedTo.name)}
                    </span>
                    {ticket.assignedTo.name}
                  </span>
                </span>
              )}
              <span>•</span>
              {/* Relative time can tick over between server render and hydration */}
              <span suppressHydrationWarning>{formatRelativeTime(ticket.createdAt, locale)}</span>
              {ticket._count.comments > 0 && (
                <span className="inline-flex items-center gap-1">
                  <MessageSquare className="w-3.5 h-3.5" />
                  {ticket._count.comments}
                </span>
              )}
              {ticket._count.attachments > 0 && (
                <span className="inline-flex items-center gap-1">
                  <Paperclip className="w-3.5 h-3.5" />
                  {ticket._count.attachments}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Status, SLA, chevron */}
        <div className="flex items-center gap-3 shrink-0 self-end md:self-center">
          <SlaChip ticket={ticket} />
          <span className={statusBadgeClass(ticket.status)}>
            <span className="badge-dot" />
            {getStatusLabel(ticket.status, locale)}
          </span>
          <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1 rtl:group-hover:-translate-x-1 rtl:rotate-180" style={{ color: 'var(--text-muted)' }} />
        </div>
      </div>
    </div>
  )
}

/** Time to the SLA deadline: green, orange within 4 hours, red when overdue */
function SlaChip({ ticket }: { ticket: TicketData }) {
  const { t } = useTranslation()
  const now = useNow()
  if (isFinished(ticket) || !ticket.slaDeadline) return null

  const msLeft = new Date(ticket.slaDeadline).getTime() - now
  const isOverdue = msLeft < 0
  const isApproaching = msLeft < 4 * 60 * 60 * 1000
  const hoursLeft = Math.max(0, Math.round(msLeft / (60 * 60 * 1000)))

  return (
    <span suppressHydrationWarning className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isOverdue ? 'bg-red-500/10 text-red-500 border border-red-500/20' : isApproaching ? 'bg-orange-500/10 text-orange-500 border border-orange-500/20' : 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'}`}>
      {isOverdue ? t('ticketList.overdue') : t('ticketList.dueInH', { hoursLeft })}
    </span>
  )
}
