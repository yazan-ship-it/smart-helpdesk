'use client'

import { useState } from 'react'
import { Activity, Lock, MessageSquare, PlusCircle, RefreshCw, UserCheck } from 'lucide-react'
import AiTranslateButton from '@/app/components/AiTranslateButton'
import { describeHistory } from '@/lib/history'
import { formatRelativeTime } from '@/lib/utils'
import { useTranslation, getStatusLabel, getPriorityLabel, getCategoryLabel } from '@/lib/i18n'
import { getInitials, type TicketDetailData } from './shared'

type Tab = 'all' | 'comments' | 'history'
type TimelineItem =
  | { type: 'comment'; id: string; date: string; data: TicketDetailData['comments'][0] }
  | { type: 'history'; id: string; date: string; data: TicketDetailData['ticketHistories'][0] }

const ASSIGN_EVENTS = ['assigned', 'auto_assigned', 'reassigned_by_admin', 'taken_over']

/** Comments and audit-trail entries in one timeline, filterable by kind */
export default function ActivityTimeline({ ticket }: { ticket: TicketDetailData }) {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<Tab>('all')

  const timeline: TimelineItem[] = [
    ...ticket.comments.map((c) => ({ type: 'comment' as const, id: `c-${c.id}`, date: c.createdAt, data: c })),
    ...ticket.ticketHistories.map((h) => ({ type: 'history' as const, id: `h-${h.id}`, date: h.createdAt, data: h })),
  ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  const displayed = timeline.filter((item) => {
    if (activeTab === 'comments') return item.type === 'comment'
    if (activeTab === 'history') return item.type === 'history'
    return true
  })

  const tabButton = (tab: Tab, label: string) => (
    <button
      onClick={() => setActiveTab(tab)}
      className={`px-3 py-1 rounded-lg transition-colors font-medium cursor-pointer ${
        activeTab === tab
          ? 'bg-indigo-600 text-foreground shadow-sm'
          : 'text-muted-foreground hover:text-foreground'
      }`}
    >
      {label}
    </button>
  )

  return (
    <>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-indigo-700 dark:text-indigo-400" />
          <h2 className="text-sm font-semibold text-foreground">
            {t('ticketPage.chronologicalActivityDiscussion')}
          </h2>
          <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-foreground border border-border">
            {t('ticketPage.responses', { length: ticket.comments.length })}
          </span>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1 bg-card p-1 rounded-xl border border-border text-xs">
          {tabButton('all', t('ticketPage.allActivity'))}
          {tabButton('comments', t('ticketPage.comments', { length: ticket.comments.length }))}
          {tabButton('history', t('ticketPage.auditTrail', { length: ticket.ticketHistories.length }))}
        </div>
      </div>

      {displayed.length === 0 ? (
        <div className="card p-8 text-center border-dashed border-border bg-muted dark:bg-card/30">
          <MessageSquare className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">
            {t('ticketPage.noActivityRecordedYet')}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {t('ticketPage.submitTheFirstDiagnosticNote')}
          </p>
        </div>
      ) : (
        <div className="relative space-y-6 before:absolute before:left-4 before:-translate-x-1/2 before:top-3 before:bottom-3 before:w-0.5 before:bg-border">
          {displayed.map((item) =>
            item.type === 'comment' ? (
              <CommentEntry key={item.id} comment={item.data} />
            ) : (
              <HistoryEntry key={item.id} entry={item.data} />
            ),
          )}
        </div>
      )}
    </>
  )
}

function CommentEntry({ comment: c }: { comment: TicketDetailData['comments'][0] }) {
  const { t, locale } = useTranslation()
  const isSupport = c.author.role === 'IT_SUPPORT'
  return (
    <div className="relative group">
      {/* Left node dot centered on vertical line */}
      <div
        className={`absolute left-4 -translate-x-1/2 top-3 w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 z-10 ${isSupport ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}
      >
        {getInitials(c.author.name)}
      </div>

      <div className="pl-11 sm:pl-12">
        <div className={`rounded-xl border p-4 shadow-sm transition-colors ${c.isInternal ? 'bg-amber-500/5 border-amber-500/20 hover:border-amber-500/40' : 'bg-card border-border hover:border-border'}`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-foreground">
                {c.author.name}
              </span>
              <span
                className={`text-[10px] px-2 py-0.5 rounded font-medium ${
                  isSupport
                    ? 'bg-indigo-500/15 text-indigo-800 dark:text-indigo-300 border border-indigo-500/30'
                    : 'bg-purple-500/15 text-purple-300 border border-purple-500/30'
                }`}
              >
                {isSupport ? t('ticketPage.itSupportAgent') : t('ticketPage.requester')}
              </span>
              {c.isInternal && (
                <span className="text-[10px] px-2 py-0.5 rounded font-bold uppercase bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 flex items-center gap-1">
                  <Lock className="w-2.5 h-2.5" />
                  {t('ticketPage.privateNote')}
                </span>
              )}
            </div>
            <span className="text-xs text-muted-foreground">
              {formatRelativeTime(c.createdAt, locale)}
            </span>
          </div>

          <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
            {c.content}
          </p>
          <AiTranslateButton text={c.content} />
        </div>
      </div>
    </div>
  )
}

function HistoryEntry({ entry: h }: { entry: TicketDetailData['ticketHistories'][0] }) {
  const { t, locale } = useTranslation()
  const isStatusAction = h.event === 'status_changed'
  const isAssignAction = ASSIGN_EVENTS.includes(h.event ?? '')
  return (
    <div className="relative group">
      {/* Left node icon centered on vertical line */}
      <div className="absolute left-4 -translate-x-1/2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-card dark:bg-card border border-border flex items-center justify-center text-muted-foreground shadow-sm shrink-0 z-10">
        {isStatusAction ? (
          <RefreshCw className="w-3.5 h-3.5 text-emerald-800 dark:text-emerald-300" />
        ) : isAssignAction ? (
          <UserCheck className="w-3.5 h-3.5 text-indigo-700 dark:text-indigo-400" />
        ) : (
          <PlusCircle className="w-3.5 h-3.5 text-purple-400" />
        )}
      </div>

      <div className="pl-11 sm:pl-12 py-1">
        <div className="text-xs text-foreground flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-foreground">
            {h.user.name}
          </span>
          <span className="text-muted-foreground">
            {describeHistory(h, h.user.name, t, {
              status: (s) => getStatusLabel(s, locale),
              priority: (p) => getPriorityLabel(p, locale),
              category: (c) => getCategoryLabel(c, locale),
            })}
          </span>
          <span>•</span>
          <span className="text-muted-foreground">{formatRelativeTime(h.createdAt, locale)}</span>
        </div>
      </div>
    </div>
  )
}
