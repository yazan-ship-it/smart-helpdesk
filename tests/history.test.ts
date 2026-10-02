import { describe, it, expect } from 'vitest'
import { describeHistory, historyData, legacyEventColumns, parseLegacyAction, type HistoryEvent } from '@/lib/history'
import { en } from '@/lib/i18n/locales/en'
import { ar } from '@/lib/i18n/locales/ar'
import { getStatusLabel, getPriorityLabel, getCategoryLabel } from '@/lib/i18n'

// Minimal stand-in for the app's t(): look up history.* keys and fill {params}
function translator(dict: typeof en) {
  return (path: string, params?: Record<string, string | number>) => {
    const template = path.split('.').reduce<unknown>((node, key) => (node as Record<string, unknown>)?.[key], dict)
    return String(template).replace(/\{(\w+)\}/g, (_, k) => String(params?.[k] ?? `{${k}}`))
  }
}
const labels = (locale: 'en' | 'ar') => ({
  status: (s: string) => getStatusLabel(s, locale),
  priority: (p: string) => getPriorityLabel(p, locale),
  category: (c: string) => getCategoryLabel(c, locale),
})
const show = (event: HistoryEvent, locale: 'en' | 'ar', actor = 'Mike Davis') =>
  describeHistory(historyData(event, actor), actor, translator(locale === 'ar' ? ar : en), labels(locale))

describe('ticket audit trail', () => {
  it('stores the event, its data and an English sentence', () => {
    expect(historyData({ type: 'status_changed', from: 'OPEN', to: 'ASSIGNED', claimed: true }, 'Bob')).toEqual({
      event: 'status_changed',
      meta: JSON.stringify({ from: 'OPEN', to: 'ASSIGNED', claimed: true }),
      action: 'Ticket claimed and status changed from OPEN to ASSIGNED',
    })
  })

  it('shows events in the viewer’s language with translated statuses', () => {
    const e: HistoryEvent = { type: 'status_changed', from: 'IN_PROGRESS', to: 'RESOLVED' }
    expect(show(e, 'en')).toBe('Status changed from In Progress to Resolved')
    expect(show(e, 'ar')).toBe(`تغيرت الحالة من ${ar.statuses.IN_PROGRESS} إلى ${ar.statuses.RESOLVED}`)
    expect(show({ type: 'comment_added' }, 'ar')).toBe('أضاف Mike Davis تعليقاً')
  })

  it('has a translation for every event type in both languages', () => {
    const events: HistoryEvent[] = [
      { type: 'created', number: 7 },
      { type: 'auto_assigned', agent: 'A', category: 'Printer' },
      { type: 'queued_unassigned', category: 'Printer' },
      { type: 'status_changed', from: 'OPEN', to: 'ASSIGNED' },
      { type: 'status_changed', from: 'OPEN', to: 'ASSIGNED', claimed: true },
      { type: 'assigned', agent: 'A' },
      { type: 'assigned', agent: 'A', from: 'B' },
      { type: 'reassigned_by_admin', agent: 'A' },
      { type: 'taken_over', from: 'B' },
      { type: 'priority_changed', to: 'HIGH' },
      { type: 'comment_added' },
      { type: 'resolution_confirmed' },
      { type: 'reopened', reason: 'broken again' },
      { type: 'csat_submitted', rating: 4 },
    ]
    for (const locale of ['en', 'ar'] as const) {
      for (const e of events) {
        const text = show(e, locale)
        expect(text, `${locale} ${e.type}`).not.toMatch(/undefined|\{\w+\}|^history\./)
      }
    }
  })

  it('falls back to the stored text for rows without an event', () => {
    expect(describeHistory({ event: null, meta: null, action: 'Something old' }, 'X', translator(ar), labels('ar'))).toBe('Something old')
  })

  it.each([
    ['Ticket #101 created', { type: 'created', number: 101 }],
    ['System auto-assigned ticket to Bob Williams based on category (Email & Communication)', { type: 'auto_assigned', agent: 'Bob Williams', category: 'Email & Communication' }],
    ['No available specialist found — ticket queued in unassigned', { type: 'queued_unassigned', category: '' }],
    ['Status changed: ASSIGNED → IN_PROGRESS', { type: 'status_changed', from: 'ASSIGNED', to: 'IN_PROGRESS' }],
    ['Ticket claimed and status changed from OPEN to ASSIGNED', { type: 'status_changed', from: 'OPEN', to: 'ASSIGNED', claimed: true }],
    ['Reassigned from Bob to Mike by Admin User', { type: 'assigned', from: 'Bob', agent: 'Mike' }],
    ['Ticket reopened by requester. Reason: still broken', { type: 'reopened', reason: 'still broken' }],
    ['CSAT Rating submitted: 5 Stars', { type: 'csat_submitted', rating: 5 }],
  ])('recognises the old sentence "%s"', (action, expected) => {
    expect(parseLegacyAction(action)).toEqual(expected)
  })

  it('round-trips: every sentence the app writes can be recognised again', () => {
    const e: HistoryEvent = { type: 'taken_over', from: 'Bob Williams' }
    const { action } = historyData(e, 'Mike Davis')
    expect(legacyEventColumns(action)).toEqual({ event: 'taken_over', meta: JSON.stringify({ from: 'Bob Williams' }) })
  })
})
