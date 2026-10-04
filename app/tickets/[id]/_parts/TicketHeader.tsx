'use client'

import { useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { ArrowLeft, Calendar, Check, Clock, Copy } from 'lucide-react'
import { SlaBadge } from '@/components/SlaBadge'
import { formatRelativeTime, formatTicketNumber } from '@/lib/utils'
import { useTranslation, getStatusLabel, getPriorityLabel, getCategoryLabel } from '@/lib/i18n'
import { priorityBadgeClass, statusBadgeClass, type TicketDetailData } from './shared'

/**
 * Back link, share button, then (after `children`, the requester's panels)
 * the number, badges and title.
 */
export default function TicketHeader({ ticket, children }: { ticket: TicketDetailData; children?: React.ReactNode }) {
  const { t, locale } = useTranslation()
  const [copied, setCopied] = useState(false)
  const isHighOrCritical = ticket.priority === 'CRITICAL' || ticket.priority === 'HIGH'
  const isFinished = ticket.status === 'RESOLVED' || ticket.status === 'CLOSED'

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    toast.success(t('toasts.linkCopied'))
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="page-header">
      <div className="flex items-center justify-between mb-3">
        <Link
          href="/tickets"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>{t('tickets.backToAllTickets')}</span>
        </Link>

        <button
          onClick={handleCopyLink}
          className="btn btn-secondary btn-sm"
          title={t('ui.copyTicketUrl')}
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-800 dark:text-emerald-300" />
              <span className="text-xs text-emerald-800 dark:text-emerald-300">{t('ticketPage.copiedUrl')}</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs">{t('ticketPage.shareLink')}</span>
            </>
          )}
        </button>
      </div>

      {children}

      {/* Title & Metadata Badges */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-3 border-b border-border">
        <div>
          <div className="flex items-center gap-2.5 mb-2 flex-wrap">
            <span className="text-xs font-mono font-medium px-2 py-0.5 rounded bg-muted text-foreground border border-border">
              #{formatTicketNumber(ticket.ticketNumber)}
            </span>
            <span className="badge badge-category">{getCategoryLabel(ticket.category, locale)}</span>
            <span className={priorityBadgeClass(ticket.priority)}>
              {isHighOrCritical && (
                <span className="relative flex h-2 w-2 mr-0.5">
                  <span
                    className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                      ticket.priority === 'CRITICAL' ? 'bg-red-400' : 'bg-orange-400'
                    }`}
                  />
                  <span
                    className={`relative inline-flex rounded-full h-2 w-2 ${
                      ticket.priority === 'CRITICAL' ? 'bg-red-500' : 'bg-orange-500'
                    }`}
                  />
                </span>
              )}
              {getPriorityLabel(ticket.priority, locale)}
            </span>
            <span className={statusBadgeClass(ticket.status)}>
              <span className="badge-dot" />
              {getStatusLabel(ticket.status, locale)}
            </span>
            {ticket.slaDeadline && !isFinished && <SlaBadge deadline={ticket.slaDeadline} />}
            {ticket.slaDeadline && isFinished && (
              <span className={`badge ${ticket.slaBreached ? 'badge-critical' : 'badge-resolved'}`}>
                {ticket.slaBreached ? t('tickets.slaMissed') : t('tickets.slaMet')}
              </span>
            )}
          </div>

          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
            {ticket.title}
          </h1>
        </div>

        <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0">
          <span className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
            {t('ticketPage.created')}{formatRelativeTime(ticket.createdAt, locale)}
          </span>
          <span>•</span>
          <span className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-muted-foreground" />
            {t('ticketPage.active')}{formatRelativeTime(ticket.updatedAt, locale)}
          </span>
        </div>
      </div>
    </div>
  )
}
