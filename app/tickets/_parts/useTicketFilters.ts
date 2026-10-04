'use client'

import { useEffect, useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

export type DateRange = 'all' | 'today' | 'week' | 'month'

/** Filters a page is opened with that aren't the user's own choice */
const KEPT_ON_CLEAR = ['queue', 'filter']
const SEARCH_DELAY_MS = 300

/**
 * The list's search and filters live in the URL (?status=OPEN&q=printer&page=2),
 * so the server filters and pages the tickets, and a filtered view can be shared
 * or reloaded. Sidebar links such as ?status=OPEN work the same way.
 */
export function useTicketFilters() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname() || '/tickets'
  const [isPending, startTransition] = useTransition()

  const get = (key: string) => searchParams?.get(key) ?? ''

  /** Change some parameters; any filter change goes back to page 1 */
  const update = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams?.toString())
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value)
      else next.delete(key)
    }
    if (!('page' in changes)) next.delete('page')
    const query = next.toString()
    startTransition(() => router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false }))
  }

  // The search box updates as the user types; the URL follows once they pause
  const urlSearch = get('q')
  const [search, setSearch] = useState(urlSearch)
  const [prevUrlSearch, setPrevUrlSearch] = useState(urlSearch)
  if (urlSearch !== prevUrlSearch) {
    // The URL changed elsewhere (clear, back button): follow it
    setPrevUrlSearch(urlSearch)
    setSearch(urlSearch)
  }
  useEffect(() => {
    if (search.trim() === urlSearch) return
    const id = setTimeout(() => update({ q: search.trim() || null }), SEARCH_DELAY_MS)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, urlSearch])

  const statusFilter = get('status')
  const priorityFilter = get('priority')
  const categoryFilter = get('category')
  const agentFilter = get('agent')
  const range = get('range')
  const dateRangeFilter: DateRange = range === 'today' || range === 'week' || range === 'month' ? range : 'all'

  const clearAll = () => {
    setSearch('')
    // Stay in the same queue ("all tickets", "assigned to me", "SLA breaches")
    const kept = new URLSearchParams()
    for (const key of KEPT_ON_CLEAR) if (get(key)) kept.set(key, get(key))
    const query = kept.toString()
    startTransition(() => router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false }))
  }

  const hasUserFilters = Boolean(urlSearch || statusFilter || priorityFilter || categoryFilter || agentFilter || range)

  return {
    search, setSearch,
    statusFilter, setStatusFilter: (value: string) => update({ status: value || null }),
    priorityFilter, setPriorityFilter: (value: string) => update({ priority: value || null }),
    categoryFilter, setCategoryFilter: (value: string) => update({ category: value || null }),
    agentFilter, setAgentFilter: (value: string) => update({ agent: value || null }),
    dateRangeFilter, setDateRangeFilter: (value: DateRange) => update({ range: value === 'all' ? null : value }),
    goToPage: (page: number) => update({ page: page > 1 ? String(page) : null }),
    activeCount: [urlSearch, statusFilter, priorityFilter, categoryFilter, agentFilter, range].filter(Boolean).length,
    /** Filters the user chose (the sidebar's queue isn't one) */
    hasUserFilters,
    /** True while the server is fetching the filtered page */
    isPending,
    clearAll,
  }
}

export type TicketFilterState = ReturnType<typeof useTicketFilters>
