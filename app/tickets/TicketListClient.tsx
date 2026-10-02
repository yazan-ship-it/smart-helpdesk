'use client'

import { useState, useMemo, useEffect, useRef, Suspense } from 'react'
import { toast } from 'sonner'
import Link from 'next/link'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { TICKET_CATEGORIES } from '@/lib/constants'
import { formatRelativeTime, formatTicketNumber } from '@/lib/utils'
import EmptyState from '@/app/components/EmptyState'
import TicketDrawer from '@/app/components/TicketDrawer'
import { motion, AnimatePresence } from 'framer-motion'
import { useIsClient } from '@/lib/useIsClient'
import { useTranslation, getStatusLabel, getPriorityLabel, getCategoryLabel } from '@/lib/i18n'
import {
 ResponsiveContainer,
 BarChart,
 Bar,
 XAxis,
 YAxis,
 Tooltip,
 Cell,
} from 'recharts'
import {
 Search,
 Plus,
 Ticket,
 Clock,
 CheckCircle2,
 AlertTriangle,
 Inbox,
 ChevronRight,
 MessageSquare,
 Paperclip,
 Activity,
 X,
 User,
 Filter,
 BarChart2,
  Layers,
 XCircle,
 Sparkles,
} from 'lucide-react'

type Status = 'OPEN' | 'ASSIGNED' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED'
type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
type Role = 'EMPLOYEE' | 'IT_SUPPORT' | 'ADMIN'

export type TicketData = {
 id: string
 ticketNumber: number
 title: string
 description: string
 category: string
 priority: Priority
 status: Status
 createdAt: string
 updatedAt: string
 createdBy: { name: string }
 assignedToId: string | null
 assignedTo: { name: string } | null
 _count: { comments: number }
 attachments: string
 slaDeadline?: string
}

type Props = {
  tickets: TicketData[]
  role: Role
  currentUserId?: string
  totalTicketCount?: number
  assignedToMeCount?: number
  activeQueue?: 'assigned_to_me' | 'all'
  agents?: { id: string; name: string }[]
  isAdminView?: boolean
  /** Admin "SLA breaches" view: the server already filtered the tickets */
  slaBreachedOnly?: boolean
}

const STATUS_FILTERS: { label: string; value: string }[] = [
 { label: 'All', value: '' },
 { label: 'Open', value: 'OPEN' },
 { label: 'Assigned', value: 'ASSIGNED' },
 { label: 'In Progress', value: 'IN_PROGRESS' },
 { label: 'Resolved', value: 'RESOLVED' },
 { label: 'Closed', value: 'CLOSED' },
]

const PRIORITY_FILTERS: { label: string; value: string }[] = [
 { label: 'All', value: '' },
 { label: 'Critical', value: 'CRITICAL' },
 { label: 'High', value: 'HIGH' },
 { label: 'Medium', value: 'MEDIUM' },
 { label: 'Low', value: 'LOW' },
]

const CATEGORIES = [...TICKET_CATEGORIES]

const PRIORITY_ORDER: Record<Priority, number> = {
 CRITICAL: 0,
 HIGH: 1,
 MEDIUM: 2,
 LOW: 3,
}

const STATUS_CHART_COLORS: Record<Status, string> = {
 OPEN: '#f59e0b',
 ASSIGNED: '#8b5cf6',
 IN_PROGRESS: '#3b82f6',
 RESOLVED: '#22c55e',
 CLOSED: '#64748b',
}

function statusBadgeClass(s: Status) {
 switch (s) {
 case 'OPEN': return 'badge badge-open'
 case 'ASSIGNED': return 'badge badge-assigned'
 case 'IN_PROGRESS': return 'badge badge-in-progress'
 case 'RESOLVED': return 'badge badge-resolved'
 case 'CLOSED': return 'badge badge-closed'
 }
}

function priorityBadgeClass(p: Priority) {
 switch (p) {
 case 'LOW': return 'badge badge-low'
 case 'MEDIUM': return 'badge badge-medium'
 case 'HIGH': return 'badge badge-high'
 case 'CRITICAL': return 'badge badge-critical'
 }
}


function getInitials(name: string) {
 if (!name) return 'U'
 const parts = name.trim().split(' ')
 if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
 return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

const containerVariants: import('framer-motion').Variants = {
 hidden: { opacity: 0 },
 show: { opacity: 1, transition: { staggerChildren: 0.04 } },
}

const itemVariants: import('framer-motion').Variants = {
 hidden: { opacity: 0, y: 8 },
 show: { opacity: 1, y: 0, transition: { duration: 0.2, ease: 'easeOut' } },
}

// Custom Recharts tooltip
function CustomTooltip({ active, payload, label }: {
 active?: boolean
 payload?: Array<{ value: number; payload: { fill: string } }>
 label?: string
}) {
 if (active && payload && payload.length) {
 return (
 <div
 className="px-3 py-2 rounded-lg text-xs font-medium shadow-lg"
 style={{
 background: 'var(--bg-surface)',
 border: '1px solid var(--border)',
 color: 'var(--text-primary)',
 }}
 >
 <span style={{ color: payload[0].payload.fill }}>{label}</span>
 <span className="ml-2 font-bold">{payload[0].value}</span>
 </div>
 )
 }
 return null
}

function matchesCategory(ticketCategory: string, filterCategory: string): boolean {
  if (!filterCategory || filterCategory === 'ALL') return true;
  if (!ticketCategory) return false;

  const tCat = ticketCategory.toLowerCase().trim();
  const fCat = filterCategory.toLowerCase().trim();

  if (tCat === fCat) return true;
  if (fCat === 'email' && tCat.includes('email')) return true;
  if (fCat.includes('access') && tCat.includes('access')) return true;

  return tCat.includes(fCat) || fCat.includes(tCat);
}

 function TicketListClientContent({ tickets, role, currentUserId, totalTicketCount, assignedToMeCount, activeQueue, agents, isAdminView, slaBreachedOnly }: Props) {
  const { t, locale } = useTranslation()
  const searchParams = useSearchParams()
  const router = useRouter()

  // Keep the queue current: re-fetch the server data every 30s while the tab is visible
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') router.refresh()
    }, 30_000)
    return () => clearInterval(id)
  }, [router])
  const pathname = usePathname()
  
  useEffect(() => {
    if (searchParams?.get('created') === 'true') {
      toast.success('Ticket created successfully')
      router.replace(pathname || '/tickets')
    }
  }, [searchParams, pathname, router])

  // ⚡ Critical ticket in-app notification for IT Support agents
  useEffect(() => {
    if (role !== 'IT_SUPPORT' || !currentUserId) return
    const myCritical = tickets.filter(
      (t) =>
        t.priority === 'CRITICAL' &&
        t.assignedToId === currentUserId &&
        t.status !== 'RESOLVED' &&
        t.status !== 'CLOSED'
    )
    if (myCritical.length > 0) {
      toast.error(
        `⚡ You have ${myCritical.length} critical incident${myCritical.length > 1 ? 's' : ''} assigned — immediate response required!`,
        { duration: 6000, id: 'critical-alert' }
      )
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // fire once on mount
 const initStatus = searchParams?.get('status') || ''
 const initPriority = searchParams?.get('priority') || ''
 const initCategory = searchParams?.get('category') || ''
 const initAgent = searchParams?.get('agent') || ''
 const isQueueAssigned = activeQueue === 'assigned_to_me' || searchParams?.get('queue') === 'assigned_to_me'
  const initAssignedToMe = isQueueAssigned || searchParams?.get('assignedToMe') === 'true'

 const [search, setSearch] = useState('')
 const [statusFilter, setStatusFilter] = useState<string>(initStatus)
 const [priorityFilter, setPriorityFilter] = useState<string>(initPriority)
 const [categoryFilter, setCategoryFilter] = useState<string>(initCategory)
 const [agentFilter, setAgentFilter] = useState<string>(initAgent)
 const [dateRangeFilter, setDateRangeFilter] = useState<string>('all') // all, today, week, month
 const [assignedToMeFilter, setAssignedToMeFilter] = useState<boolean>(initAssignedToMe)
 const [showFilters, setShowFilters] = useState(false)
 const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null)
 const searchInputRef = useRef<HTMLInputElement>(null)

 const mounted = useIsClient()

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

 useEffect(() => {
 const handleKeyDown = (e: KeyboardEvent) => {
 if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
 e.preventDefault()
 searchInputRef.current?.focus()
 } else if (
 e.key === '/' &&
 document.activeElement !== searchInputRef.current &&
 !(document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLTextAreaElement)
 ) {
 e.preventDefault()
 searchInputRef.current?.focus()
 }
 }
 window.addEventListener('keydown', handleKeyDown)
 return () => window.removeEventListener('keydown', handleKeyDown)
 }, [])

 const clearAllFilters = () => {
   setSearch('')
   setStatusFilter('')
   setPriorityFilter('')
   setCategoryFilter('')
   setAgentFilter('')
   setDateRangeFilter('all')
   setAssignedToMeFilter(false)
   if (pathname) {
     router.replace(pathname) // clear URL params too
   }
 }

 const activeFiltersCount = [
   search.trim() ? 1 : 0,
   statusFilter ? 1 : 0,
   priorityFilter ? 1 : 0,
   categoryFilter ? 1 : 0,
   agentFilter ? 1 : 0,
   dateRangeFilter !== 'all' ? 1 : 0,
   assignedToMeFilter ? 1 : 0
 ].reduce((a, b) => a + b, 0)

 const filtered = useMemo(() => {
 let list = tickets
 if (statusFilter) {
      const statuses = statusFilter.split(',').map(s => s.toLowerCase())
      list = list.filter((t) => statuses.includes(t.status.toLowerCase()))
    }
 if (priorityFilter) list = list.filter((t) => t.priority.toLowerCase() === priorityFilter.toLowerCase())
 if (categoryFilter) list = list.filter((t) => matchesCategory(t.category, categoryFilter))
 if (agentFilter) {
   if (agentFilter === 'unassigned') {
     list = list.filter((t) => !t.assignedToId)
   } else {
     list = list.filter((t) => t.assignedToId === agentFilter)
   }
 }
 if (dateRangeFilter !== 'all') {
   const now = new Date()
   if (dateRangeFilter === 'today') {
     list = list.filter(t => new Date(t.createdAt).toDateString() === now.toDateString())
   } else if (dateRangeFilter === 'week') {
     const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
     list = list.filter(t => new Date(t.createdAt) >= weekAgo)
   } else if (dateRangeFilter === 'month') {
     const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
     list = list.filter(t => new Date(t.createdAt) >= monthAgo)
   }
 }
 if (assignedToMeFilter && currentUserId) {
 list = list.filter((t) => t.assignedToId === currentUserId)
 }

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
 (t.assignedTo && t.assignedTo.name.toLowerCase().includes(q))
 )
 }
 return list.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority])
 }, [tickets, search, statusFilter, priorityFilter, categoryFilter, agentFilter, dateRangeFilter, assignedToMeFilter, currentUserId])

 const stats = useMemo(() => ({
 total: tickets.length,
 open: tickets.filter((t) => t.status === 'OPEN').length,
 assigned: tickets.filter((t) => t.status === 'ASSIGNED').length,
 inProgress: tickets.filter((t) => t.status === 'IN_PROGRESS').length,
 resolved: tickets.filter((t) => t.status === 'RESOLVED').length,
 closed: tickets.filter((t) => t.status === 'CLOSED').length,
 critical: tickets.filter((t) => t.priority === 'CRITICAL').length,
 }), [tickets])

 // Chart data
 const chartData = useMemo(() => [
  { name: locale === 'ar' ? 'مفتوحة' : 'Open', count: stats.open, fill: STATUS_CHART_COLORS.OPEN },
  { name: locale === 'ar' ? 'مسندة' : 'Assigned', count: stats.assigned, fill: STATUS_CHART_COLORS.ASSIGNED },
  { name: locale === 'ar' ? 'قيد العمل' : 'In Progress', count: stats.inProgress, fill: STATUS_CHART_COLORS.IN_PROGRESS },
  { name: locale === 'ar' ? 'تم الحل' : 'Resolved', count: stats.resolved, fill: STATUS_CHART_COLORS.RESOLVED },
  { name: locale === 'ar' ? 'مغلقة' : 'Closed', count: stats.closed, fill: STATUS_CHART_COLORS.CLOSED },
  ], [stats, locale])



 return (
 <div className="animate-fade-up">
 {/* ─── PAGE HEADER ─────────────────────────── */}
 <div className="page-header flex flex-col sm:flex-row sm:items-center justify-between gap-4">
 <div>
 <div className="flex items-center gap-2.5 mb-1.5">
 <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
 {isAdminView ? t('nav.allTickets') : (role === 'IT_SUPPORT' ? (locale === 'ar' ? 'قائمة العمليات والدعم' : 'Support Operations Queue') : (locale === 'ar' ? 'تذاكر الدعم الخاصة بي' : 'My Support Tickets'))}
 </h1>
 <span
 className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-medium"
 style={{
 background: 'var(--brand-muted)',
 border: '1px solid var(--border-focus)',
 color: 'var(--brand)',
 }}
 >
 <span className="w-1.5 h-1.5 rounded-full bg-emerald-100 dark:bg-emerald-950 animate-pulse" />
 {locale === 'ar' ? 'تحديث تلقائي' : 'Auto-refresh'}
 </span>
 {stats.critical > 0 && (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-100 text-rose-800 border border-rose-300 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800/50">
      <AlertTriangle className="w-3.5 h-3.5 animate-pulse" />
      {stats.critical} {locale === 'ar' ? 'حرجة' : 'Critical'}
    </span>
 )}
 </div>
 <p className="text-base font-normal text-muted-foreground/90 mt-1.5">
          {isAdminView
            ? (locale === 'ar' ? 'إدارة ومتابعة كافة بلاغات الدعم الفني للمؤسسة.' : 'Manage and oversee all enterprise helpdesk requests.')
            : (role === 'IT_SUPPORT'
              ? (locale === 'ar' ? 'فرز وتعيين وحل طلبات الدعم الفني للمؤسسة في الوقت الفعلي.' : 'Triage, assign, and resolve enterprise helpdesk requests in real time.')
              : (locale === 'ar' ? 'متابعة الحالة، الردود، والتشخيص الذكي لبلاغاتك.' : 'Track status, replies, and automated AI diagnoses for your requests.'))}
        </p>
 </div>

 {role === 'EMPLOYEE' && (
 <Link
 href="/tickets/new"
 className="btn btn-primary shrink-0"
 style={{ boxShadow: '0 4px 14px var(--brand-glow)' }}
 >
 <Plus className="w-4 h-4" />
 <span>{t('tickets.createNew')}</span>
 </Link>
 )}
 </div>

 <div className="page-content space-y-6">
      {slaBreachedOnly && (
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl border border-red-500/30 bg-red-500/5 text-sm">
          <span className="flex items-center gap-2 text-red-700 dark:text-red-300 font-medium">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {t('tickets.slaBreachedOnly')}
          </span>
          <Link href="/admin/tickets" className="text-xs font-semibold underline">
            {t('tickets.showAllTickets')}
          </Link>
        </div>
      )}
       {/* ─── 0. IT SUPPORT QUEUE SWITCHER TABS ───────────────── */}
      {role === 'IT_SUPPORT' && (
        <div className="flex items-center gap-2 p-1 bg-muted/60 dark:bg-muted/30 rounded-2xl border border-border w-fit">
          <Link
            href="/tickets?queue=assigned_to_me"
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
              (searchParams?.get('queue') === 'assigned_to_me' || searchParams?.get('assignedToMe') === 'true' || activeQueue === 'assigned_to_me') && searchParams?.get('queue') !== 'all'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-background/60'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>{t('nav.assignedToMe')}</span>
            <span
              className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold ${
                (searchParams?.get('queue') === 'assigned_to_me' || searchParams?.get('assignedToMe') === 'true' || activeQueue === 'assigned_to_me') && searchParams?.get('queue') !== 'all'
                  ? 'bg-primary-foreground/20 text-primary-foreground'
                  : 'bg-muted text-muted-foreground border border-border'
              }`}
            >
              {assignedToMeCount ?? tickets.filter((t) => t.assignedToId === currentUserId).length}
            </span>
          </Link>

          <Link
            href="/tickets?queue=all"
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
              searchParams?.get('queue') === 'all'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-background/60'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>{t('nav.allTickets')}</span>
            <span
              className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold ${
                searchParams?.get('queue') === 'all'
                  ? 'bg-primary-foreground/20 text-primary-foreground'
                  : 'bg-muted text-muted-foreground border border-border'
              }`}
            >
              {totalTicketCount ?? tickets.length}
            </span>
          </Link>
        </div>
      )}

      {/* ─── 1. SIX STAT CARDS ─────────────────── */}
 <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
 {/* Total */}
 <StatCard
 label={role === 'EMPLOYEE' ? (locale === 'ar' ? 'إجمالي تذاكري' : 'My Total') : t('kpis.totalTickets')}
 value={stats.total}
 icon={<Inbox className="w-4 h-4" />}
 iconBg="var(--brand-muted)"
 iconColor="var(--brand)"
 />
 {/* Open */}
 <StatCard
 label={role === 'EMPLOYEE' ? (locale === 'ar' ? 'تذاكري المفتوحة' : 'My Open') : t('statuses.OPEN')}
 value={stats.open}
 icon={<Ticket className="w-4 h-4" />}
 iconBg="rgba(245,158,11,0.12)"
 iconColor="#f59e0b"
 valueColor="#f59e0b"
 />
 {/* In Progress */}
				<StatCard
					label={role === 'EMPLOYEE' ? (locale === 'ar' ? 'قيد العمل' : 'My In Progress') : t('statuses.IN_PROGRESS')}
					value={stats.inProgress}
					icon={<Activity className="w-4 h-4" />}
					iconBg="rgba(59,130,246,0.12)"
					iconColor="#3b82f6"
					valueColor="#3b82f6"
				/>
				{/* Resolved */}
				<StatCard
					label={role === 'EMPLOYEE' ? (locale === 'ar' ? 'تم الحل' : 'My Resolved') : t('statuses.RESOLVED')}
					value={stats.resolved}
					icon={<CheckCircle2 className="w-4 h-4" />}
					iconBg="rgba(34,197,94,0.12)"
					iconColor="#22c55e"
					valueColor="#22c55e"
				/>
				{/* Closed */}
				<StatCard
					label={role === 'EMPLOYEE' ? (locale === 'ar' ? 'تذاكري المغلقة' : 'My Closed') : t('statuses.CLOSED')}
					value={stats.closed}
					icon={<CheckCircle2 className="w-4 h-4" />}
					iconBg="rgba(161,161,170,0.12)"
					iconColor="#a1a1aa"
					valueColor="#a1a1aa"
				/>
				{/* Critical */}
				<StatCard
					label={role === 'EMPLOYEE' ? (locale === 'ar' ? 'حرجة' : 'My Critical') : (locale === 'ar' ? 'حرجة' : 'Critical')}
					value={stats.critical}
					icon={<AlertTriangle className="w-4 h-4" />}
					iconBg="rgba(239,68,68,0.12)"
					iconColor="#ef4444"
					valueColor="#ef4444"
					pulse={stats.critical > 0}
				/>
			</div>

 {/* ─── 2. ANALYTICS CHART ─────────────────── */}
 {mounted && (
 <div
 className="rounded-xl p-5"
 style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
 >
 <div className="flex items-center gap-2 mb-4">
 <BarChart2 className="w-4 h-4" style={{ color: 'var(--brand)' }} />
 <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
 {locale === 'ar' ? 'التذاكر حسب الحالة' : 'Tickets by Status'}
 </h2>
 <span className="text-xs ml-auto" style={{ color: 'var(--text-muted)' }}>
 {tickets.length} {locale === 'ar' ? 'إجمالي' : 'total'}
 </span>
 </div>
 <div style={{ height: 140 }}>
 <ResponsiveContainer width="100%" height="100%">
 <BarChart data={chartData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }} barSize={28}>
 <XAxis
 dataKey="name"
 tick={{ fontSize: 11, fill: 'var(--text-primary)' }}
 axisLine={false}
 tickLine={false}
 />
 <YAxis
 allowDecimals={false}
 tick={{ fontSize: 11, fill: 'var(--text-primary)' }}
 axisLine={false}
 tickLine={false}
 interval="preserveStartEnd"
 width={30}
 />
 <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--bg-hover)' }} />
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

 {/* ─── 3. SEARCH & FILTERS ────────────────── */}
 <div className="space-y-3">
 {/* Search + Filter toggle */}
 <div className="flex items-center gap-3">
 <div
 className="relative flex items-center flex-1"
 style={{
 background: 'var(--bg-surface)',
 border: '1px solid var(--border)',
 borderRadius: '10px',
 padding: '0 12px',
 transition: 'border-color 0.15s',
 }}
 >
 <Search className="w-4 h-4 shrink-0 mr-3 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
 <input
 ref={searchInputRef}
 type="text"
 value={search}
 onChange={(e) => setSearch(e.target.value)}
 placeholder={locale === 'ar' ? 'البحث بالعنوان، رقم التذكرة، مقدم الطلب...' : 'Search by title, ticket ID, requester…'}
 className="w-full bg-transparent text-sm outline-none border-0 ring-0 py-2.5"
 style={{ color: 'var(--text-primary)' }}
 />
 {search && (
 <button
 type="button"
 onClick={() => setSearch('')}
 className="p-1 rounded cursor-pointer"
 style={{ color: 'var(--text-muted)' }}
 >
 <X className="w-3.5 h-3.5" />
 </button>
 )}
 </div>
 <button
 type="button"
 onClick={() => setShowFilters((f) => !f)}
 className="btn btn-secondary btn-sm gap-2 relative"
 style={{
 background: showFilters ? 'var(--brand-muted)' : undefined,
 borderColor: showFilters ? 'var(--border-focus)' : undefined,
 color: showFilters ? 'var(--brand)' : undefined,
 }}
 >
 <Filter className="w-3.5 h-3.5" />
					{locale === 'ar' ? 'الفلاتر' : 'Filters'}
 {activeFiltersCount > 0 && (
 <span
 className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full text-[10px] font-bold flex items-center justify-center text-foreground"
 style={{ background: 'var(--brand)' }}
 >
 {activeFiltersCount}
 </span>
 )}
 </button>
 {activeFiltersCount > 0 && (
 <button
 type="button"
 onClick={clearAllFilters}
 className="btn btn-ghost btn-sm"
 style={{ color: 'var(--text-muted)' }}
 >
 <XCircle className="w-3.5 h-3.5" />
					{locale === 'ar' ? 'مسح' : 'Clear'}
 </button>
 )}
 </div>

 {/* Status pill tabs (always visible) */}
 <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
 {STATUS_FILTERS.map((f) => {
 const count = f.value ? tickets.filter((t) => t.status === f.value).length : tickets.length
 const isActive = statusFilter === f.value
 return (
 <button
 key={f.value}
 type="button"
 onClick={() => setStatusFilter(f.value)}
 className="filter-pill"
 style={(statusFilter === f.value || statusFilter.split(',').includes(f.value)) && f.value !== '' ? {
 background: 'var(--brand-muted)',
 borderColor: 'var(--border-focus)',
 color: 'var(--brand)',
 } : (statusFilter === '' && f.value === '') ? {
 background: 'var(--brand-muted)',
 borderColor: 'var(--border-focus)',
 color: 'var(--brand)',
 } : undefined}
 >
 {f.value ? getStatusLabel(f.value, locale) : (locale === 'ar' ? 'الكل' : 'All')}
 <span
 className="text-[10px] font-mono px-1 py-0.5 rounded-full"
 style={{
 background: isActive ? 'var(--bg-hover)' : 'var(--bg-overlay)',
 color: isActive ? 'var(--brand)' : 'var(--text-muted)',
 }}
 >
 {count}
 </span>
 </button>
 )
 })}
 </div>

 {/* Expanded filters panel */}
 <AnimatePresence>
 {showFilters && (
 <motion.div
 initial={{ opacity: 0, height: 0 }}
 animate={{ opacity: 1, height: 'auto' }}
 exit={{ opacity: 0, height: 0 }}
 transition={{ duration: 0.2 }}
 className="overflow-hidden"
 >
 <div
 className="rounded-xl p-4 space-y-3"
 style={{
 background: 'var(--bg-surface)',
 border: '1px solid var(--border)',
 }}
 >
 {/* Priority filter */}
 <div>
 <p className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-primary)' }}>{t('common.priority')}</p>
 <div className="flex flex-wrap gap-1.5">
 {PRIORITY_FILTERS.map((f) => (
 <button
 key={f.value}
 type="button"
 onClick={() => setPriorityFilter(f.value)}
 className="filter-pill"
 style={priorityFilter === f.value ? {
 background: 'var(--brand-muted)',
 borderColor: 'var(--border-focus)',
 color: 'var(--brand)',
 } : undefined}
 >
 {f.value ? getPriorityLabel(f.value, locale) : (locale === 'ar' ? 'الكل' : 'All')}
 </button>
 ))}
 </div>
 </div>

 {/* Category filter */}
 <div>
 <p className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-primary)' }}>
 {t('common.category')}
 </p>
 <div className="flex flex-wrap gap-1.5">
 <button
 type="button"
 onClick={() => setCategoryFilter('')}
 className="filter-pill"
 style={!categoryFilter ? {
 background: 'var(--brand-muted)',
 borderColor: 'var(--border-focus)',
 color: 'var(--brand)',
 } : undefined}
 >
 {locale === 'ar' ? 'الكل' : 'All'}
 </button>
 {CATEGORIES.map((cat) => (
 <button
 key={cat}
 type="button"
 onClick={() => setCategoryFilter(cat)}
 className="filter-pill"
 style={categoryFilter === cat ? {
 background: 'var(--brand-muted)',
 borderColor: 'var(--border-focus)',
 color: 'var(--brand)',
 } : undefined}
 >
 {getCategoryLabel(cat, locale)}
 </button>
 ))}
 </div>
 </div>

 {/* Assigned Agent filter */}
 {isAdminView && agents && agents.length > 0 && (
 <div>
 <p className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-primary)' }}>{locale === 'ar' ? 'الموظف المسند إليه' : 'Assigned Agent'}</p>
 <div className="flex flex-wrap gap-1.5">
 <button
 type="button"
 onClick={() => setAgentFilter('')}
 className="filter-pill"
 style={!agentFilter ? {
 background: 'var(--brand-muted)',
 borderColor: 'var(--border-focus)',
 color: 'var(--brand)',
 } : undefined}
 >
 All
 </button>
 <button
 type="button"
 onClick={() => setAgentFilter('unassigned')}
 className="filter-pill"
 style={agentFilter === 'unassigned' ? {
 background: 'var(--brand-muted)',
 borderColor: 'var(--border-focus)',
 color: 'var(--brand)',
 } : undefined}
 >{locale === 'ar' ? 'غير مسندة' : 'Unassigned'}</button>
 {agents.map((ag) => (
 <button
 key={ag.id}
 type="button"
 onClick={() => setAgentFilter(ag.id)}
 className="filter-pill"
 style={agentFilter === ag.id ? {
 background: 'var(--brand-muted)',
 borderColor: 'var(--border-focus)',
 color: 'var(--brand)',
 } : undefined}
 >
 {ag.name}
 </button>
 ))}
 </div>
 </div>
 )}

 {/* Date Range filter */}
 <div>
 <p className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-primary)' }}>{locale === 'ar' ? 'النطاق الزمني' : 'Date Range'}</p>
 <div className="flex flex-wrap gap-1.5">
 {['all', 'today', 'week', 'month'].map((range) => (
 <button
 key={range}
 type="button"
 onClick={() => setDateRangeFilter(range)}
 className="filter-pill capitalize"
 style={dateRangeFilter === range ? {
 background: 'var(--brand-muted)',
 borderColor: 'var(--border-focus)',
 color: 'var(--brand)',
 } : undefined}
 >
 {locale === 'ar'
    ? (range === 'all' ? 'كافة الأوقات' : range === 'today' ? 'اليوم' : range === 'week' ? 'آخر 7 أيام' : range === 'month' ? 'آخر 30 يوماً' : range)
    : (range === 'all' ? 'All Time' : range === 'today' ? 'Today' : range === 'week' ? 'Past 7 Days' : range === 'month' ? 'Past 30 Days' : range)}
 </button>
 ))}
 </div>
 </div>

 </div>
 </motion.div>
 )}
 </AnimatePresence>
 </div>

 {/* ─── 4. RESULTS SUMMARY ─────────────────── */}
 <div className="flex items-center justify-between">
 <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
 {locale === 'ar' ? (
    <>عرض <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{filtered.length}</span> من {tickets.length} تذكرة</>
  ) : (
    <>Showing <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{filtered.length}</span> of {tickets.length} tickets</>
  )}
 </p>
 </div>

 {/* ─── 5. TICKET LIST ─────────────────────── */}
 {filtered.length === 0 ? (
  role === 'EMPLOYEE' && !(search || statusFilter || priorityFilter || categoryFilter) ? (
    <div className="flex flex-col items-center justify-center p-12 text-center rounded-2xl border border-border bg-card shadow-sm animate-fade-in mt-4">
      <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 flex items-center justify-center mb-5">
        <Sparkles className="w-8 h-8 text-indigo-500" />
      </div>
      <h3 className="text-2xl font-bold text-foreground mb-2">{locale === 'ar' ? 'كافة الأنظمة تعمل بكفاءة!' : 'All systems operational!'}</h3>
      <p className="text-base text-muted-foreground max-w-md mb-8">
        {locale === 'ar' ? 'ليس لديك أي تذاكر دعم مفتوحة حالياً. هل تحتاج مساعدة في الأجهزة أو البرامج أو الشبكات؟' : "You don't have any open support tickets right now. Need help with hardware, software, or network access?"}
      </p>
      <Link href="/tickets/new" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition-colors shadow-sm">
        <Plus className="w-5 h-5" />
        {t('tickets.createNew')}
      </Link>
    </div>
  ) : (
    <EmptyState
    title={search || statusFilter || priorityFilter || categoryFilter ? (locale === 'ar' ? 'لا توجد تذاكر تطابق الفلاتر المحددة' : 'No tickets match your active filters') : (locale === 'ar' ? 'لا توجد تذاكر في هذه القائمة' : 'No tickets in this queue')}
    description={search || statusFilter || priorityFilter || categoryFilter ? (locale === 'ar' ? 'جرب إعادة تعيين الفلاتر أو تعديل عبارة البحث.' : 'Try clearing filters or adjusting your search query.') : (locale === 'ar' ? 'تم حل أو تصنيف كافة البلاغات بنجاح.' : 'All enterprise issues have been resolved or triaged.')}
    icon={<Inbox className="w-8 h-8 text-[var(--text-muted)]" />}
    >
    {(search || statusFilter || priorityFilter || categoryFilter) && (
    <button
    type="button"
    onClick={clearAllFilters}
    className="btn btn-secondary btn-sm inline-flex"
    >
    {locale === 'ar' ? 'إعادة ضبط كافة الفلاتر' : 'Clear all filters'}
    </button>
    )}
    </EmptyState>
  )
 ) : (
 <motion.div
 variants={containerVariants}
 initial="hidden"
 animate="show"
 className={role === 'EMPLOYEE' ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" : "space-y-2"}
 >
 <AnimatePresence mode="popLayout">
 {filtered.map((ticket) => {
 const attachmentCount = (() => {
 try { return JSON.parse(ticket.attachments || '[]').length } catch { return 0 }
 })()
 const isHighOrCritical = ticket.priority === 'CRITICAL' || ticket.priority === 'HIGH'

 return (
 <motion.div
 key={ticket.id}
 variants={itemVariants}
 layout
 initial={{ opacity: 0, y: 8 }}
 animate={{ opacity: 1, y: 0 }}
 exit={{ opacity: 0, y: -8 }}
 >
  {role === 'EMPLOYEE' ? (
  <Link
    href={`/tickets/${ticket.id}`}
    className="group flex flex-col p-5 rounded-2xl transition-all duration-200 relative overflow-hidden bg-card border border-border shadow-sm hover:shadow-md hover:border-indigo-500/50 cursor-pointer h-full"
  >
    {/* Mini Stepper */}
    <div className="flex items-center gap-1 mb-4">
      {['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'].map((step, idx) => {
        const statuses = ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];
        const ticketIdx = statuses.indexOf(ticket.status);
        const isPast = idx <= ticketIdx;
        return (
          <div key={step} className="flex-1 h-1.5 rounded-full transition-colors" style={{
            background: isPast ? 'var(--brand)' : 'var(--border)'
          }} />
        )
      })}
    </div>

    <div className="flex items-start justify-between gap-2 mb-3">
      <div className="flex flex-col gap-1.5">
        <span className="font-mono text-xs font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded-md w-fit border border-border">
          #{formatTicketNumber(ticket.ticketNumber)}
        </span>
        <h3 className="font-bold text-base text-foreground leading-tight line-clamp-2 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
          {ticket.title}
        </h3>
      </div>
    </div>
    
    <div className="mt-auto pt-4 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-md bg-secondary text-secondary-foreground border border-border">
          <Layers className="w-3.5 h-3.5 text-muted-foreground" />
          {getCategoryLabel(ticket.category, locale)}
        </span>
        <span className="text-xs text-muted-foreground ml-auto rtl:ml-0 rtl:mr-auto flex items-center gap-1">
          <Clock className="w-3.5 h-3.5" />
          {formatRelativeTime(ticket.createdAt, locale)}
        </span>
      </div>
      
      <div className="flex items-center justify-between pt-3 border-t border-border/50">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-[9px] font-bold text-indigo-700 dark:text-indigo-300">
            {ticket.assignedTo ? getInitials(ticket.assignedTo.name) : '?'}
          </div>
          <span className="text-xs font-medium text-muted-foreground">
            {ticket.assignedTo ? ticket.assignedTo.name : (locale === 'ar' ? 'جاري الفرز والتوجيه...' : 'Being triaged...')}
          </span>
        </div>
        <span className={statusBadgeClass(ticket.status)}>
          <span className="badge-dot" />
          {getStatusLabel(ticket.status, locale)}
        </span>
      </div>
    </div>
  </Link>
  ) : (
  <div
  role="button"
  tabIndex={0}
  onClick={() => setSelectedTicketId(ticket.id)}
  className={`group block p-4 rounded-xl transition-all duration-200 relative overflow-hidden text-start w-full ${ticket.priority === 'CRITICAL' && ticket.status !== 'RESOLVED' && ticket.status !== 'CLOSED' ? 'border-2 border-red-500/50 bg-red-500/5' : ''}`}
  style={{
  background: ticket.priority === 'CRITICAL' && ticket.status !== 'RESOLVED' && ticket.status !== 'CLOSED' ? undefined : 'var(--bg-surface)',
  border: ticket.priority === 'CRITICAL' && ticket.status !== 'RESOLVED' && ticket.status !== 'CLOSED' ? undefined : '1px solid var(--border)',
  }}
  onMouseEnter={(e) => {
  e.currentTarget.style.transform = 'translateY(-1px)'
  e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.08)'
  }}
  onMouseLeave={(e) => {
  e.currentTarget.style.transform = ''
  e.currentTarget.style.boxShadow = ''
  }}
  >
  {/* Priority accent bar */}
  <div
  className="absolute start-0 top-0 bottom-0 w-[3px]"
  style={{
  background:
  ticket.priority === 'CRITICAL' ? '#ef4444' :
  ticket.priority === 'HIGH' ? '#f97316' :
  ticket.priority === 'MEDIUM' ? '#f59e0b' :
  '#22c55e',
  opacity: 0.7,
  }}
  />

  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 ps-2">
  {/* Left: Avatar + details */}
  <div className="flex items-start gap-3 min-w-0 flex-1">
  <div
  className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold text-foreground shrink-0 mt-0.5"
  style={{
  background: ticket.createdBy.name.toLowerCase().includes('bob')
  ? 'linear-gradient(135deg, var(--brand), #06b6d4)'
  : 'linear-gradient(135deg, #a78bfa, #ec4899)',
  }}
  >
  {getInitials(ticket.createdBy.name)}
  </div>

  <div className="min-w-0 flex-1">
  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
  <span
  className="font-mono text-[11px] font-semibold px-2 py-0.5 rounded-md"
  style={{
  background: 'var(--bg-elevated)',
  color: 'var(--text-secondary)',
  border: '1px solid var(--border)',
  }}
  >
  #{formatTicketNumber(ticket.ticketNumber)}
  </span>
  <span
  className="text-[11px] font-medium px-2 py-0.5 rounded-md"
  style={{
  background: 'var(--bg-elevated)',
  color: 'var(--text-secondary)',
  border: '1px solid var(--border)',
  }}
  >
  {getCategoryLabel(ticket.category, locale)}
  </span>
  <span className={`${priorityBadgeClass(ticket.priority)} text-[11px] inline-flex items-center`}>
  {isHighOrCritical && (
  <span className="relative flex h-2 w-2 mr-1 rtl:mr-0 rtl:ml-1">
  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${ticket.priority === 'CRITICAL' ? 'bg-red-400' : 'bg-orange-400'}`} />
  <span className={`relative inline-flex rounded-full h-2 w-2 ${ticket.priority === 'CRITICAL' ? 'bg-red-500' : 'bg-orange-500'}`} />
  </span>
  )}
  {getPriorityLabel(ticket.priority, locale)}
  </span>
  </div>

  <h3
  className="font-semibold text-sm truncate"
  style={{ color: 'var(--text-primary)' }}
  >
  {ticket.title}
  </h3>

  <div className="flex items-center gap-3 mt-1.5 text-xs flex-wrap" style={{ color: 'var(--text-muted)' }}>
  <span className="flex items-center gap-1" style={{ color: 'var(--text-secondary)' }}>
  <User className="w-3 h-3" style={{ color: 'var(--text-muted)' }} />
  {ticket.createdBy.name}
  </span>
  {ticket.assignedTo && (
  <span className="inline-flex items-center gap-1">
  <span style={{ color: 'var(--text-primary)' }}>→</span>
  <span
  className="font-medium px-1.5 py-0.5 rounded text-[11px]"
  style={{
  color: 'var(--brand)',
  background: 'var(--brand-muted)',
  border: '1px solid var(--border-focus)',
  }}
  >
  <span className="w-4 h-4 rounded-full bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 flex items-center justify-center text-[8px] font-bold shrink-0">
                        {getInitials(ticket.assignedTo.name)}
                      </span>
                      {ticket.assignedTo.name}
  </span>
  </span>
  )}
  <span>•</span>
  <span>{formatRelativeTime(ticket.createdAt, locale)}</span>
  {ticket._count.comments > 0 && (
  <span className="inline-flex items-center gap-1">
  <MessageSquare className="w-3.5 h-3.5" />
  {ticket._count.comments}
  </span>
  )}
  {attachmentCount > 0 && (
  <span className="inline-flex items-center gap-1">
  <Paperclip className="w-3.5 h-3.5" />
  {attachmentCount}
  </span>
  )}
  </div>
  </div>
  </div>

  {/* Right: Status + SLA + chevron */}
  <div className="flex items-center gap-3 shrink-0 self-end md:self-center">
  {(() => {
   if (ticket.status === 'RESOLVED' || ticket.status === 'CLOSED') return null
   const isOverdue = ticket.slaDeadline && new Date(ticket.slaDeadline).getTime() < Date.now()
   const isApproaching = ticket.slaDeadline && new Date(ticket.slaDeadline).getTime() < Date.now() + 1000 * 60 * 60 * 4
   if (!ticket.slaDeadline) return null
   
   const deadline = new Date(ticket.slaDeadline)
   const hoursLeft = Math.max(0, Math.round((deadline.getTime() - Date.now()) / (1000 * 60 * 60)))
   
   return (
     <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isOverdue ? 'bg-red-500/10 text-red-500 border border-red-500/20' : isApproaching ? 'bg-orange-500/10 text-orange-500 border border-orange-500/20' : 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'}`}>
       {isOverdue ? (locale === 'ar' ? 'متأخر' : 'Overdue') : (locale === 'ar' ? `متبقي ${hoursLeft}س` : `Due in ${hoursLeft}h`)}
     </span>
   )
  })()}
  <span className={statusBadgeClass(ticket.status)}>
  <span className="badge-dot" />
  {getStatusLabel(ticket.status, locale)}
  </span>
  <ChevronRight
  className="w-4 h-4 transition-transform group-hover:translate-x-1 rtl:group-hover:-translate-x-1 rtl:rotate-180"
  style={{ color: 'var(--text-muted)' }}
  />
  </div>
  </div>
  </div>
  )}
 </motion.div>
 )
 })}
 </AnimatePresence>
 </motion.div>
 )}
 </div>
 <TicketDrawer 
   ticketId={selectedTicketId} 
   isOpen={!!selectedTicketId} 
   onClose={() => setSelectedTicketId(null)} 
   currentUserId={currentUserId || ''} 
 />
 </div>
 )
}

// ─── Stat Card Component ─────────────────────────────
function StatCard({
 label,
 value,
 icon,
 iconBg,
 iconColor,
 valueColor,
 pulse = false,
}: {
 label: string
 value: number
 icon: React.ReactNode
 iconBg: string
 iconColor: string
 valueColor?: string
 pulse?: boolean
}) {
 return (
 <div
 className="stat-card"
 style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
 >
 <div style={{ background: iconBg, color: iconColor }} className={`stat-icon${pulse ? ' animate-pulse' : ''}`}>
 {icon}
 </div>
 <div>
 <div
 className="stat-value"
 style={{ color: valueColor ?? 'var(--text-primary)' }}
 >
 {value}
 </div>
 <div className="stat-label">{label}</div>
 </div>
 </div>
 )
}

export default function TicketListClient(props: Props) {
 return (
 <Suspense fallback={<div>Loading...</div>}>
 <TicketListClientContent {...props} />
 </Suspense>
 )
}
