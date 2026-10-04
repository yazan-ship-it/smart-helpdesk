'use client'

import { useMemo } from 'react'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts'
import { Activity, AlertTriangle, BarChart2, CheckCircle2, Inbox, Ticket } from 'lucide-react'
import type { Status } from '@/lib/ticket-status'
import { useIsClient } from '@/lib/useIsClient'
import { useTranslation } from '@/lib/i18n'
import type { TicketListStats } from '@/lib/ticket-query'
import type { Role } from './types'

const STATUS_CHART_COLORS: Record<Status, string> = {
  OPEN: '#f59e0b',
  ASSIGNED: '#8b5cf6',
  IN_PROGRESS: '#3b82f6',
  RESOLVED: '#22c55e',
  CLOSED: '#64748b',
}

/** The six counters and the tickets-by-status chart, for every ticket in the queue (not only this page) */
export default function StatsOverview({ stats: s, role }: { stats: TicketListStats; role: Role }) {
  const { t } = useTranslation()
  const mounted = useIsClient()
  const stats = useMemo(
    () => ({ total: s.total, open: s.byStatus.OPEN, assigned: s.byStatus.ASSIGNED, inProgress: s.byStatus.IN_PROGRESS, resolved: s.byStatus.RESOLVED, closed: s.byStatus.CLOSED, critical: s.critical }),
    [s],
  )
  const mine = role === 'EMPLOYEE'

  const chartData = useMemo(
    () => [
      { name: t('ticketList.open'), count: stats.open, fill: STATUS_CHART_COLORS.OPEN },
      { name: t('ticketList.assigned'), count: stats.assigned, fill: STATUS_CHART_COLORS.ASSIGNED },
      { name: t('ticketList.inProgress'), count: stats.inProgress, fill: STATUS_CHART_COLORS.IN_PROGRESS },
      { name: t('ticketList.resolved'), count: stats.resolved, fill: STATUS_CHART_COLORS.RESOLVED },
      { name: t('ticketList.closed'), count: stats.closed, fill: STATUS_CHART_COLORS.CLOSED },
    ],
    [stats, t],
  )

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard label={mine ? t('ticketList.myTotal') : t('kpis.totalTickets')} value={stats.total} icon={<Inbox className="w-4 h-4" />} iconBg="var(--brand-muted)" iconColor="var(--brand)" />
        <StatCard label={mine ? t('ticketList.myOpen') : t('statuses.OPEN')} value={stats.open} icon={<Ticket className="w-4 h-4" />} iconBg="rgba(245,158,11,0.12)" iconColor="#f59e0b" valueColor="#f59e0b" />
        <StatCard label={mine ? t('ticketList.myInProgress') : t('statuses.IN_PROGRESS')} value={stats.inProgress} icon={<Activity className="w-4 h-4" />} iconBg="rgba(59,130,246,0.12)" iconColor="#3b82f6" valueColor="#3b82f6" />
        <StatCard label={mine ? t('ticketList.myResolved') : t('statuses.RESOLVED')} value={stats.resolved} icon={<CheckCircle2 className="w-4 h-4" />} iconBg="rgba(34,197,94,0.12)" iconColor="#22c55e" valueColor="#22c55e" />
        <StatCard label={mine ? t('ticketList.myClosed') : t('statuses.CLOSED')} value={stats.closed} icon={<CheckCircle2 className="w-4 h-4" />} iconBg="rgba(161,161,170,0.12)" iconColor="#a1a1aa" valueColor="#a1a1aa" />
        <StatCard label={mine ? t('ticketList.myCritical') : t('ticketList.critical')} value={stats.critical} icon={<AlertTriangle className="w-4 h-4" />} iconBg="rgba(239,68,68,0.12)" iconColor="#ef4444" valueColor="#ef4444" pulse={stats.critical > 0} />
      </div>

      {/* The chart measures its container, so it renders on the client only */}
      {mounted && (
        <div className="rounded-xl p-5" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
          <div className="flex items-center gap-2 mb-4">
            <BarChart2 className="w-4 h-4" style={{ color: 'var(--brand)' }} />
            <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              {t('ticketList.ticketsByStatus')}
            </h2>
            <span className="text-xs ml-auto" style={{ color: 'var(--text-muted)' }}>
              {stats.total} {t('ticketList.total')}
            </span>
          </div>
          <div style={{ height: 140 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }} barSize={28}>
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-primary)' }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--text-primary)' }} axisLine={false} tickLine={false} interval="preserveStartEnd" width={30} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--bg-hover)' }} />
                <Bar dataKey="count" radius={[5, 5, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={index} fill={entry.fill} opacity={0.85} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </>
  )
}

function ChartTooltip({ active, payload, label }: {
  active?: boolean
  payload?: Array<{ value: number; payload: { fill: string } }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div
      className="px-3 py-2 rounded-lg text-xs font-medium shadow-lg"
      style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
    >
      <span style={{ color: payload[0].payload.fill }}>{label}</span>
      <span className="ml-2 font-bold">{payload[0].value}</span>
    </div>
  )
}

function StatCard({ label, value, icon, iconBg, iconColor, valueColor, pulse = false }: {
  label: string
  value: number
  icon: React.ReactNode
  iconBg: string
  iconColor: string
  valueColor?: string
  pulse?: boolean
}) {
  return (
    <div className="stat-card" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
      <div style={{ background: iconBg, color: iconColor }} className={`stat-icon${pulse ? ' animate-pulse' : ''}`}>
        {icon}
      </div>
      <div>
        <div className="stat-value" style={{ color: valueColor ?? 'var(--text-primary)' }}>
          {value}
        </div>
        <div className="stat-label">{label}</div>
      </div>
    </div>
  )
}
