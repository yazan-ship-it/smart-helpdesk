/**
 * Ticket audit-trail events. Each row stores the event type and its data, so
 * the timeline can be shown in the viewer's language. `action` keeps an
 * English sentence for logs, exports and rows written before events existed.
 * Pure module: used by server actions and the ticket page.
 */

export type HistoryEvent =
  | { type: 'created'; number: number }
  | { type: 'auto_assigned'; agent: string; category: string }
  | { type: 'queued_unassigned'; category: string }
  | { type: 'status_changed'; from: string; to: string; claimed?: boolean }
  | { type: 'assigned'; agent: string; from?: string }
  | { type: 'reassigned_by_admin'; agent: string }
  | { type: 'taken_over'; from: string }
  | { type: 'priority_changed'; to: string }
  | { type: 'comment_added' }
  | { type: 'resolution_confirmed' }
  | { type: 'reopened'; reason: string }
  | { type: 'csat_submitted'; rating: number }

function englishSentence(e: HistoryEvent, actor: string): string {
  switch (e.type) {
    case 'created':
      return `Ticket #${e.number} created`
    case 'auto_assigned':
      return `System auto-assigned ticket to ${e.agent} based on category (${e.category})`
    case 'queued_unassigned':
      return `No available specialist found for ${e.category} — ticket queued in Unassigned`
    case 'status_changed':
      return `Ticket${e.claimed ? ' claimed and' : ''} status changed from ${e.from} to ${e.to}`
    case 'assigned':
      return e.from ? `Reassigned from ${e.from} to ${e.agent} by ${actor}` : `Ticket assigned to ${e.agent} by ${actor}`
    case 'reassigned_by_admin':
      return `Ticket reassigned to ${e.agent} by Admin`
    case 'taken_over':
      return `Ticket taken over by ${actor} (reassigned from ${e.from})`
    case 'priority_changed':
      return `Priority updated to ${e.to}`
    case 'comment_added':
      return `Comment added by ${actor}`
    case 'resolution_confirmed':
      return 'Resolution confirmed by requester. Ticket closed.'
    case 'reopened':
      return `Ticket reopened by requester. Reason: ${e.reason}`
    case 'csat_submitted':
      return `CSAT Rating submitted: ${e.rating} Stars`
  }
}

/** Columns to store for an audit entry. `actor` is the display name of whoever acted. */
export function historyData(event: HistoryEvent, actor: string) {
  const { type, ...meta } = event
  return { event: type, meta: JSON.stringify(meta), action: englishSentence(event, actor) }
}

/** Read a stored row back into an event, or null for rows that only have the old text. */
export function readHistoryEvent(row: { event: string | null; meta: string | null }): HistoryEvent | null {
  if (!row.event) return null
  try {
    return { type: row.event, ...(row.meta ? JSON.parse(row.meta) : {}) } as HistoryEvent
  } catch {
    return null
  }
}

type Translate = (path: string, params?: Record<string, string | number>) => string
type Labels = { status: (s: string) => string; priority: (p: string) => string; category: (c: string) => string }

/** The sentence to show for an audit entry, in the viewer's language. */
export function describeHistory(
  row: { event: string | null; meta: string | null; action: string },
  actor: string,
  t: Translate,
  labels: Labels,
): string {
  const e = readHistoryEvent(row)
  if (!e) return row.action

  switch (e.type) {
    case 'created':
      return t('history.created', { number: e.number })
    case 'auto_assigned':
      return t('history.auto_assigned', { agent: e.agent, category: labels.category(e.category) })
    case 'queued_unassigned':
      return t('history.queued_unassigned', { category: labels.category(e.category) })
    case 'status_changed':
      return t(e.claimed ? 'history.status_changed_claimed' : 'history.status_changed', {
        from: labels.status(e.from),
        to: labels.status(e.to),
      })
    case 'assigned':
      return e.from
        ? t('history.reassigned', { from: e.from, agent: e.agent, actor })
        : t('history.assigned', { agent: e.agent, actor })
    case 'reassigned_by_admin':
      return t('history.reassigned_by_admin', { agent: e.agent })
    case 'taken_over':
      return t('history.taken_over', { actor, from: e.from })
    case 'priority_changed':
      return t('history.priority_changed', { to: labels.priority(e.to) })
    case 'comment_added':
      return t('history.comment_added', { actor })
    case 'resolution_confirmed':
      return t('history.resolution_confirmed')
    case 'reopened':
      return t('history.reopened', { reason: e.reason })
    case 'csat_submitted':
      return t('history.csat_submitted', { rating: e.rating })
    default:
      return row.action
  }
}

const STATUS = '(OPEN|ASSIGNED|IN_PROGRESS|RESOLVED|CLOSED)'

/**
 * Recognise the English sentences written before events were stored, so old
 * rows can be converted once (see scripts/backfill-history-events.ts).
 */
export function parseLegacyAction(action: string): HistoryEvent | null {
  let m: RegExpMatchArray | null
  if ((m = action.match(/^Ticket #(\d+) created$/))) return { type: 'created', number: Number(m[1]) }
  if ((m = action.match(/^System auto-assigned ticket to (.+) based on category \((.+?)\)/)))
    return { type: 'auto_assigned', agent: m[1], category: m[2] }
  if ((m = action.match(/^No available specialist found(?: for (.+?))? — ticket queued in unassigned$/i)))
    return { type: 'queued_unassigned', category: m[1] ?? '' }
  if ((m = action.match(new RegExp(`^Status changed: ${STATUS} → ${STATUS}$`))))
    return { type: 'status_changed', from: m[1], to: m[2] }
  if ((m = action.match(new RegExp(`^Ticket( claimed and)? status changed from ${STATUS} to ${STATUS}$`))))
    return { type: 'status_changed', from: m[2], to: m[3], ...(m[1] ? { claimed: true } : {}) }
  if ((m = action.match(/^Reassigned from (.+) to (.+) by .+$/))) return { type: 'assigned', from: m[1], agent: m[2] }
  if ((m = action.match(/^Ticket assigned to (.+) by .+?(?: \(status: .+\))?$/))) return { type: 'assigned', agent: m[1] }
  if ((m = action.match(/^Ticket reassigned to (.+) by Admin$/))) return { type: 'reassigned_by_admin', agent: m[1] }
  if ((m = action.match(/^Ticket taken over by .+ \(reassigned from (.+)\)$/))) return { type: 'taken_over', from: m[1] }
  if ((m = action.match(/^Priority updated to (LOW|MEDIUM|HIGH|CRITICAL)$/))) return { type: 'priority_changed', to: m[1] }
  if (/^Comment added by .+$/.test(action)) return { type: 'comment_added' }
  if (action === 'Resolution confirmed by requester. Ticket closed.') return { type: 'resolution_confirmed' }
  if ((m = action.match(/^Ticket reopened by requester\. Reason: ([\s\S]*)$/))) return { type: 'reopened', reason: m[1] }
  if ((m = action.match(/^CSAT Rating submitted: (\d) Stars$/))) return { type: 'csat_submitted', rating: Number(m[1]) }
  return null
}

/** event/meta columns for an old English-only row, or {} if it isn't recognised. */
export function legacyEventColumns(action: string): { event?: string; meta?: string } {
  const parsed = parseLegacyAction(action)
  if (!parsed) return {}
  const { type, ...meta } = parsed
  return { event: type, meta: JSON.stringify(meta) }
}
