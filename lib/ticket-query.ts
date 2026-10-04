import 'server-only'

import type { Prisma } from '@/lib/generated/prisma/client'
import { prisma } from '@/lib/db'
import type { Status } from '@/lib/ticket-status'
import type { Priority } from '@/lib/ticket-display'

/** Tickets per page in the lists */
export const PAGE_SIZE = 20

const STATUSES: Status[] = ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']
/** The list shows the most urgent first, newest first within each priority */
const PRIORITY_ORDER: Priority[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']
const DATE_RANGES = ['today', 'week', 'month'] as const
const DAY = 24 * 60 * 60 * 1000

export type DateRange = (typeof DATE_RANGES)[number]

/** The filters a list URL can carry (?status=OPEN,ASSIGNED&priority=HIGH&q=printer&page=2) */
export type TicketFilters = {
  statuses: Status[]
  priority?: Priority
  category?: string
  /** An agent's id, or "unassigned" */
  agent?: string
  q?: string
  range?: DateRange
  page: number
}

type Params = { [key: string]: string | string[] | undefined }

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)?.trim() || undefined

/** Read the filters from the URL, ignoring anything that isn't a valid value */
export function parseTicketFilters(params: Params): TicketFilters {
  const statuses = (one(params.status) ?? '')
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter((s): s is Status => STATUSES.includes(s as Status))
  const priority = one(params.priority)?.toUpperCase()
  const range = one(params.range)
  const page = Number.parseInt(one(params.page) ?? '1', 10)

  return {
    statuses,
    priority: PRIORITY_ORDER.includes(priority as Priority) ? (priority as Priority) : undefined,
    category: one(params.category)?.slice(0, 100),
    agent: one(params.agent)?.slice(0, 64),
    q: one(params.q)?.slice(0, 100),
    range: DATE_RANGES.includes(range as DateRange) ? (range as DateRange) : undefined,
    page: Number.isFinite(page) && page > 0 ? page : 1,
  }
}

/** Older tickets may use previous category names ("Email", "Access Issue") */
function categoryWhere(category: string): Prisma.TicketWhereInput {
  const lower = category.toLowerCase()
  if (lower.includes('email')) return { category: { contains: 'email', mode: 'insensitive' } }
  if (lower.includes('access')) return { category: { contains: 'access', mode: 'insensitive' } }
  return { category: { equals: category, mode: 'insensitive' } }
}

/** The `where` for the filters, to combine with the page's own scope (whose tickets the user may see) */
export function filterWhere(filters: TicketFilters, now: Date = new Date()): Prisma.TicketWhereInput {
  const and: Prisma.TicketWhereInput[] = []

  if (filters.statuses.length > 0) and.push({ status: { in: filters.statuses } })
  if (filters.priority) and.push({ priority: filters.priority })
  if (filters.category) and.push(categoryWhere(filters.category))
  if (filters.agent) and.push({ assignedToId: filters.agent === 'unassigned' ? null : filters.agent })

  if (filters.range) {
    const since =
      filters.range === 'today'
        ? new Date(now.getFullYear(), now.getMonth(), now.getDate())
        : new Date(now.getTime() - (filters.range === 'week' ? 7 : 30) * DAY)
    and.push({ createdAt: { gte: since } })
  }

  if (filters.q) {
    const contains = { contains: filters.q, mode: 'insensitive' as const }
    const number = /^#?\d{1,9}$/.test(filters.q) ? Number.parseInt(filters.q.replace('#', ''), 10) : null
    and.push({
      OR: [
        { title: contains },
        { description: contains },
        { category: contains },
        { id: filters.q },
        ...(number !== null ? [{ ticketNumber: number }] : []),
        { createdBy: { name: contains } },
        { assignedTo: { name: contains } },
      ],
    })
  }

  return and.length > 0 ? { AND: and } : {}
}

export type TicketListStats = {
  total: number
  byStatus: Record<Status, number>
  critical: number
}

const listInclude = {
  createdBy: { select: { name: true } },
  assignedTo: { select: { name: true } },
  _count: { select: { comments: true, attachments: true } },
} satisfies Prisma.TicketInclude

/**
 * One page of tickets, most urgent first, plus the counts the list shows.
 *
 * Priority is stored as text, so the database can't sort CRITICAL > HIGH > MEDIUM > LOW
 * by itself. Instead we count the matches per priority and read the page from those
 * groups in order: at most one query per priority, each using the createdAt order.
 */
export async function loadTicketPage(scope: Prisma.TicketWhereInput, filters: TicketFilters, now: Date = new Date()) {
  const where: Prisma.TicketWhereInput = { AND: [scope, filterWhere(filters, now)] }

  const [byPriority, byStatus, critical] = await Promise.all([
    prisma.ticket.groupBy({ by: ['priority'], where, _count: { _all: true } }),
    // The counters and status pills describe the whole scope, not the filtered view
    prisma.ticket.groupBy({ by: ['status'], where: scope, _count: { _all: true } }),
    prisma.ticket.count({ where: { AND: [scope, { priority: 'CRITICAL' }] } }),
  ])

  const countOf = (priority: Priority) => byPriority.find((g) => g.priority === priority)?._count._all ?? 0
  const matching = PRIORITY_ORDER.reduce((sum, p) => sum + countOf(p), 0)
  const pageCount = Math.max(1, Math.ceil(matching / PAGE_SIZE))
  const page = Math.min(filters.page, pageCount)

  // Which slice of each priority group falls on this page
  let skip = (page - 1) * PAGE_SIZE
  let take = PAGE_SIZE
  const slices: { priority: Priority; skip: number; take: number }[] = []
  for (const priority of PRIORITY_ORDER) {
    const size = countOf(priority)
    if (take === 0) break
    if (skip >= size) {
      skip -= size
      continue
    }
    const n = Math.min(size - skip, take)
    slices.push({ priority, skip, take: n })
    take -= n
    skip = 0
  }

  const groups = await Promise.all(
    slices.map((s) =>
      prisma.ticket.findMany({
        where: { AND: [where, { priority: s.priority }] },
        include: listInclude,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: s.skip,
        take: s.take,
      }),
    ),
  )

  const statusCounts = Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<Status, number>
  for (const g of byStatus) if (g.status in statusCounts) statusCounts[g.status as Status] = g._count._all

  const stats: TicketListStats = {
    total: STATUSES.reduce((sum, s) => sum + statusCounts[s], 0),
    byStatus: statusCounts,
    critical,
  }

  const tickets = groups.flat().map((t) => ({
    ...t,
    priority: t.priority as Priority,
    status: t.status as Status,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
    slaDeadline: t.slaDeadline ? t.slaDeadline.toISOString() : undefined,
  }))

  return { tickets, matching, page, pageCount, stats }
}
