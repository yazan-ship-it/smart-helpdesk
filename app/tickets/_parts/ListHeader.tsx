'use client'

import Link from 'next/link'
import { AlertTriangle, Layers, Plus, User } from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import { useTranslation } from '@/lib/i18n'
import type { Role } from './types'

/** Title, live badge, critical count and (for employees) the create button */
export function ListHeader({ role, isAdminView, criticalCount }: { role: Role; isAdminView?: boolean; criticalCount: number }) {
  const { t } = useTranslation()

  return (
    <div className="page-header flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <div className="flex items-center gap-2.5 mb-1.5">
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
            {isAdminView ? t('nav.allTickets') : role === 'IT_SUPPORT' ? t('ticketList.supportOperationsQueue') : t('ticketList.mySupportTickets')}
          </h1>
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-medium"
            style={{ background: 'var(--brand-muted)', border: '1px solid var(--border-focus)', color: 'var(--brand)' }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-100 dark:bg-emerald-950 animate-pulse" />
            {t('ticketList.autoRefresh')}
          </span>
          {criticalCount > 0 && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-100 text-rose-800 border border-rose-300 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800/50">
              <AlertTriangle className="w-3.5 h-3.5 animate-pulse" />
              {criticalCount} {t('ticketList.critical')}
            </span>
          )}
        </div>
        <p className="text-base font-normal text-muted-foreground/90 mt-1.5">
          {isAdminView
            ? t('ticketList.manageAndOverseeAllEnterprise')
            : role === 'IT_SUPPORT'
              ? t('ticketList.triageAssignAndResolveEnterprise')
              : t('ticketList.trackTheStatusOfYour')}
        </p>
      </div>

      {role === 'EMPLOYEE' && (
        <Link href="/tickets/new" className="btn btn-primary shrink-0" style={{ boxShadow: '0 4px 14px var(--brand-glow)' }}>
          <Plus className="w-4 h-4" />
          <span>{t('tickets.createNew')}</span>
        </Link>
      )}
    </div>
  )
}

/** IT support: switch between "assigned to me" and "all tickets" */
export function QueueTabs({ activeQueue, assignedCount, totalCount }: { activeQueue?: 'assigned_to_me' | 'all'; assignedCount: number; totalCount: number }) {
  const { t } = useTranslation()
  const searchParams = useSearchParams()
  const queue = searchParams?.get('queue')
  const mineActive = (queue === 'assigned_to_me' || searchParams?.get('assignedToMe') === 'true' || activeQueue === 'assigned_to_me') && queue !== 'all'
  const allActive = queue === 'all'

  const tab = (href: string, active: boolean, icon: React.ReactNode, label: string, count: number) => (
    <Link
      href={href}
      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
        active ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-background/60'
      }`}
    >
      {icon}
      <span>{label}</span>
      <span
        className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold ${
          active ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-muted-foreground border border-border'
        }`}
      >
        {count}
      </span>
    </Link>
  )

  return (
    <div className="flex items-center gap-2 p-1 bg-muted/60 dark:bg-muted/30 rounded-2xl border border-border w-fit">
      {tab('/tickets?queue=assigned_to_me', mineActive, <User className="w-3.5 h-3.5" />, t('nav.assignedToMe'), assignedCount)}
      {tab('/tickets?queue=all', allActive, <Layers className="w-3.5 h-3.5" />, t('nav.allTickets'), totalCount)}
    </div>
  )
}
