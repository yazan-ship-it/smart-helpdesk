'use client'

import { useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import type { Priority } from '@/lib/ticket-display'
import type { TicketData } from './types'

export type DateRange = 'all' | 'today' | 'week' | 'month'

const PRIORITY_ORDER: Record<Priority, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 }
const DAY = 24 * 60 * 60 * 1000

/** Older tickets may use previous category names ("Email", "Access Issue") */
function matchesCategory(ticketCategory: string, filterCategory: string): boolean {
  if (!filterCategory || filterCategory === 'ALL') return true
  if (!ticketCategory) return false

  const tCat = ticketCategory.toLowerCase().trim()
  const fCat = filterCategory.toLowerCase().trim()

  if (tCat === fCat) return true
  if (fCat === 'email' && tCat.includes('email')) return true
  if (fCat.includes('access') && tCat.includes('access')) return true

  return tCat.includes(fCat) || fCat.includes(tCat)
}

/**
 * The list's search and filters. They start from the URL (sidebar links such
 * as ?status=OPEN or ?queue=assigned_to_me) and follow it when it changes.
 */
export function useTicketFilters(tickets: TicketData[], currentUserId: string | undefined, activeQueue: 'assigned_to_me' | 'all' | undefined) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const isQueueAssigned = activeQueue === 'assigned_to_me' || searchParams?.get('queue') === 'assigned_to_me'

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState(searchParams?.get('status') || '')
  const [priorityFilter, setPriorityFilter] = useState(searchParams?.get('priority') || '')
  const [categoryFilter, setCategoryFilter] = useState(searchParams?.get('category') || '')
  const [agentFilter, setAgentFilter] = useState(searchParams?.get('agent') || '')
  const [dateRangeFilter, setDateRangeFilter] = useState<DateRange>('all')
  const [assignedToMeFilter, setAssignedToMeFilter] = useState(isQueueAssigned || searchParams?.get('assignedToMe') === 'true')

  // Re-sync filters when the URL changes (adjusting state during render instead of in an effect)
  const [prevSearchParams, setPrevSearchParams] = useState(searchParams)
  if (searchParams !== prevSearchParams) {
    setPrevSearchParams(searchParams)
    setStatusFilter(searchParams?.get('status') || '')
    setPriorityFilter(searchParams?.get('priority') || '')
    setCategoryFilter(searchParams?.get('category') || '')
    setAgentFilter(searchParams?.get('agent') || '')
    setAssignedToMeFilter(searchParams?.get('queue') === 'assigned_to_me' || searchParams?.get('assignedToMe') === 'true')
  }

  const clearAll = () => {
    setSearch('')
    setStatusFilter('')
    setPriorityFilter('')
    setCategoryFilter('')
    setAgentFilter('')
    setDateRangeFilter('all')
    setAssignedToMeFilter(false)
    // Clear the URL's filters too, but stay in the same queue ("all tickets" or "assigned to me")
    const queue = searchParams?.get('queue')
    if (pathname) router.replace(queue ? `${pathname}?queue=${encodeURIComponent(queue)}` : pathname)
  }

  const activeCount = [
    search.trim(),
    statusFilter,
    priorityFilter,
    categoryFilter,
    agentFilter,
    dateRangeFilter !== 'all',
    assignedToMeFilter,
  ].filter(Boolean).length

  const filtered = useMemo(() => {
    let list = tickets
    if (statusFilter) {
      const statuses = statusFilter.split(',').map((s) => s.toLowerCase())
      list = list.filter((t) => statuses.includes(t.status.toLowerCase()))
    }
    if (priorityFilter) list = list.filter((t) => t.priority.toLowerCase() === priorityFilter.toLowerCase())
    if (categoryFilter) list = list.filter((t) => matchesCategory(t.category, categoryFilter))
    if (agentFilter) {
      list = agentFilter === 'unassigned' ? list.filter((t) => !t.assignedToId) : list.filter((t) => t.assignedToId === agentFilter)
    }
    if (dateRangeFilter !== 'all') {
      const now = new Date()
      if (dateRangeFilter === 'today') list = list.filter((t) => new Date(t.createdAt).toDateString() === now.toDateString())
      else {
        const since = new Date(now.getTime() - (dateRangeFilter === 'week' ? 7 : 30) * DAY)
        list = list.filter((t) => new Date(t.createdAt) >= since)
      }
    }
    if (assignedToMeFilter && currentUserId) list = list.filter((t) => t.assignedToId === currentUserId)

    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          t.category.toLowerCase().includes(q) ||
          t.id.toLowerCase().includes(q) ||
          String(t.ticketNumber).includes(q) ||
          t.createdBy.name.toLowerCase().includes(q) ||
          (t.assignedTo && t.assignedTo.name.toLowerCase().includes(q)),
      )
    }
    return [...list].sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority])
  }, [tickets, search, statusFilter, priorityFilter, categoryFilter, agentFilter, dateRangeFilter, assignedToMeFilter, currentUserId])

  return {
    search, setSearch,
    statusFilter, setStatusFilter,
    priorityFilter, setPriorityFilter,
    categoryFilter, setCategoryFilter,
    agentFilter, setAgentFilter,
    dateRangeFilter, setDateRangeFilter,
    activeCount,
    /** Filters the employee chose (the sidebar's queue isn't one) */
    hasUserFilters: Boolean(search || statusFilter || priorityFilter || categoryFilter),
    clearAll,
    filtered,
  }
}

export type TicketFilterState = ReturnType<typeof useTicketFilters>
