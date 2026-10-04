'use client'

import { formatRelativeTime } from '@/lib/utils'
import { useTranslation, getStatusLabel, getPriorityLabel, getCategoryLabel } from '@/lib/i18n'
import { priorityBadgeClass, statusBadgeClass, type TicketDetailData } from './shared'

/** Status, priority, category, people and times at a glance */
export default function PropertiesCard({ ticket }: { ticket: TicketDetailData }) {
  const { t, locale } = useTranslation()

  const row = (label: string, value: React.ReactNode, last = false) => (
    <div className={`flex items-center justify-between py-1.5${last ? '' : ' border-b border-border'}`}>
      <span className="text-muted-foreground">{label}</span>
      {value}
    </div>
  )

  return (
    <div className="card p-5 border-border bg-card backdrop-blur-md space-y-4">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        {t('ticketPage.ticketDetails')}
      </h3>

      <div className="space-y-3 text-xs">
        {row(
          t('ticketPage.currentStatus'),
          <span className={statusBadgeClass(ticket.status)}>
            <span className="badge-dot" />
            {getStatusLabel(ticket.status, locale)}
          </span>,
        )}
        {row(t('ticketPage.severity'), <span className={priorityBadgeClass(ticket.priority)}>{getPriorityLabel(ticket.priority, locale)}</span>)}
        {row(t('ticketPage.category'), <span className="badge badge-category">{getCategoryLabel(ticket.category, locale)}</span>)}
        {row(t('ticketPage.submittedBy'), <span className="font-semibold text-foreground">{ticket.createdBy.name}</span>)}
        {row(
          t('ticketPage.assignedSpecialist'),
          <span className="font-medium text-foreground">
            {ticket.assignedTo ? (
              <span className="inline-flex items-center gap-1.5 text-indigo-800 dark:text-indigo-300 font-semibold">
                <span className="w-2 h-2 rounded-full bg-indigo-400" />
                {ticket.assignedTo.name}
              </span>
            ) : (
              <span className="text-muted-foreground italic">{t('ticketPage.unassigned')}</span>
            )}
          </span>,
        )}
        {row(t('ticketPage.createdAt'), <span className="text-foreground">{formatRelativeTime(ticket.createdAt, locale)}</span>)}
        {row(t('ticketPage.lastUpdated'), <span className="text-foreground">{formatRelativeTime(ticket.updatedAt, locale)}</span>, true)}
      </div>
    </div>
  )
}
