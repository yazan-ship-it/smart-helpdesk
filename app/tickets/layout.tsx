import Link from 'next/link'
import { Ticket, Plus, User, FolderX, AlertTriangle, Monitor, Code, Wifi, Mail, Key, Hash, LifeBuoy, Printer, Shield } from 'lucide-react'
import { getSession } from '@/lib/session'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/db'
import { getBrandName } from '@/lib/brand'
import { getAppSettings } from '@/lib/settings'
import UserDropdown from '@/app/components/UserDropdown'
import ResponsiveSidebar from '@/app/components/ResponsiveSidebar'
import AvailabilityToggle from '@/app/components/AvailabilityToggle'
import ThemeSwitcher from '@/app/components/ThemeSwitcher'

export default async function TicketsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSession()
  const cookieStore = await cookies()
  const locale = (cookieStore.get('helpdesk-lang')?.value === 'ar' ? 'ar' : 'en') as 'en' | 'ar'
  const brandName = getBrandName((await getAppSettings())?.appName, locale)

  // Fetch counts
  const userId = session?.userId

  const baseWhere = session?.role === 'EMPLOYEE' ? { createdById: userId } : {}

  const [
    assignedToMe,
    unassigned,
    critical,
    hardware,
    software,
    network,
    email,
    access,
    other,
    printer,
  ] = await Promise.all([
    prisma.ticket.count({ where: { ...baseWhere, assignedToId: userId, status: { notIn: ['RESOLVED', 'CLOSED'] } } }),
    prisma.ticket.count({ where: { assignedToId: null, status: 'OPEN' } }),
    prisma.ticket.count({ where: { priority: 'CRITICAL', status: { notIn: ['RESOLVED', 'CLOSED'] } } }),
    prisma.ticket.count({ where: { ...baseWhere, category: 'Hardware' } }),
    prisma.ticket.count({ where: { ...baseWhere, category: 'Software' } }),
    prisma.ticket.count({ where: { ...baseWhere, category: 'Network' } }),
    prisma.ticket.count({ where: { ...baseWhere, OR: [{ category: 'Email' }, { category: 'Email & Communication' }] } }),
    prisma.ticket.count({ where: { ...baseWhere, OR: [{ category: 'Access Issue' }, { category: 'Access & Permissions' }] } }),
    prisma.ticket.count({ where: { ...baseWhere, category: 'Other' } }),
    prisma.ticket.count({ where: { ...baseWhere, category: 'Printer' } }),
  ])

  // Get current agent's availability
  let agentAvailability = true
  if (session?.role === 'IT_SUPPORT' && userId) {
    const agent = await prisma.user.findUnique({
      where: { id: userId },
      select: { isAvailable: true },
    })
    agentAvailability = agent?.isAvailable ?? true
  }

  if (session?.role === 'EMPLOYEE') {
    return (
      <div className="flex flex-col h-screen overflow-hidden" style={{ background: 'var(--bg-base)' }}>
        {/* Top Header */}
        <header className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-[var(--border)] bg-[var(--bg-elevated)] shrink-0 gap-3">
          {/* The brand shrinks (with an ellipsis) so the actions on the other side always fit */}
          <div className="flex items-center gap-8 min-w-0 flex-1">
            <div className="flex items-center gap-3 min-w-0">
              <LifeBuoy className="w-8 h-8 text-[var(--brand)] shrink-0" />
              <div className="min-w-0">
                <p className="text-lg md:text-2xl font-extrabold tracking-tight truncate" style={{ color: 'var(--text-primary)' }}>
                  {brandName}
                </p>
                <p className="text-[10px] uppercase tracking-wider font-semibold truncate" style={{ color: 'var(--text-muted)' }}>
                  {locale === 'ar' ? 'بوابة الموظف' : 'Employee Portal'}
                </p>
              </div>
            </div>

            <nav className="hidden md:flex items-center gap-1 shrink-0">
              <Link href="/tickets" className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--bg-hover)] text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                <Ticket className="w-4 h-4 text-[var(--brand)]" />
                <span>{locale === 'ar' ? 'تذاكري' : 'My Tickets'}</span>
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {/* Icon-only on phones (the .btn class sets display, so Tailwind's "hidden" can't hide it) */}
            <Link
              href="/tickets/new"
              className="btn btn-primary text-sm h-9 px-2.5 sm:px-4 items-center shadow-sm"
              aria-label={locale === 'ar' ? 'إنشاء تذكرة' : 'Create Ticket'}
            >
              <Plus className="w-4 h-4 sm:me-1.5" />
              <span className="hidden sm:inline">{locale === 'ar' ? 'إنشاء تذكرة' : 'Create Ticket'}</span>
            </Link>

            <ThemeSwitcher />
            <UserDropdown user={{ name: session?.name || 'User', role: session?.role ?? '' }} />
          </div>
        </header>

        {/* Main */}
        <main className="flex-1 overflow-y-auto" style={{ background: 'var(--bg-base)' }}>
          <div className="max-w-7xl mx-auto w-full h-full">
            {children}
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg-base)' }}>
      {/* Sidebar */}
      <ResponsiveSidebar title={brandName} className="flex flex-col w-64 border-r rtl:border-r-0 rtl:border-l border-[var(--border)] bg-[var(--bg-elevated)] h-full shrink-0">
        {/* Brand */}
        <div className="sidebar-brand p-4 flex items-center justify-between gap-2 border-b border-[var(--border)] overflow-hidden shrink-0">
          <div className="flex items-center gap-3 min-w-0 shrink-0 whitespace-nowrap">
            <LifeBuoy className="w-8 h-8 text-[var(--brand)] shrink-0" />
            <div className="shrink-0 whitespace-nowrap">
              <p className="text-base font-extrabold tracking-tight whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>
                {brandName}
              </p>
              <p className="text-[10px] tracking-wide whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>
                {locale === 'ar' ? 'منصة الدعم الفني' : 'IT Support Platform'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <ThemeSwitcher />
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto p-4 space-y-6">

          <div>
            <p className="nav-section-label text-[10px] font-bold uppercase tracking-wider mb-2 text-[var(--text-muted)]">{locale === 'ar' ? 'مساحة العمل' : 'Workspace'}</p>
            <div className="space-y-1">
              <Link href="/tickets" className="nav-link flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-[var(--bg-hover)] text-sm text-[var(--text-secondary)]">
                <div className="flex items-center gap-2">
                  <Ticket className="w-4 h-4" />
                  <span>{locale === 'ar' ? 'لوحة المؤشرات' : 'Dashboard'}</span>
                </div>
              </Link>
              {session?.role === 'ADMIN' && (
                <Link href="/admin/users" className="nav-link flex items-center justify-between px-2 py-1.5 rounded-md bg-indigo-500/10 text-indigo-600 hover:bg-indigo-500/20 text-sm font-medium mt-2 border border-indigo-500/20">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    <span>{locale === 'ar' ? 'العودة للإدارة' : 'Back to Admin'}</span>
                  </div>
                </Link>
              )}
            </div>
          </div>

          {session?.role === 'IT_SUPPORT' && (
            <>
              {/* ⚡ Critical Alert Banner in sidebar */}
              {critical > 0 && (
                <div className="rounded-xl p-3 bg-red-500/10 border border-red-500/30 space-y-1">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                    <span className="text-xs font-bold text-red-600 dark:text-red-400">
                      {locale === 'ar' ? `${critical} بلاغ حرج نشط` : `${critical} Critical Incident${critical > 1 ? 's' : ''} Active`}
                    </span>
                  </div>
                  <p className="text-[10px] text-red-500/80 dark:text-red-400/80 leading-relaxed">
                    {locale === 'ar' ? 'البلاغات الحرجة غير المحلولة تتطلب استجابة فورية.' : 'Unresolved critical tickets require immediate attention.'}
                  </p>
                  <Link
                    href="/tickets?priority=CRITICAL"
                    className="inline-flex items-center gap-1 mt-1 text-[10px] font-semibold text-red-600 dark:text-red-400 hover:underline"
                  >
                    {locale === 'ar' ? 'عرض قائمة البلاغات الحرجة ←' : 'View Critical Queue →'}
                  </Link>
                </div>
              )}

              <div>
                <p className="nav-section-label text-[10px] font-bold uppercase tracking-wider mb-2 text-[var(--text-muted)]">{locale === 'ar' ? 'قوائم الانتظار التشغيلية' : 'Operational Queues'}</p>
                <div className="space-y-1">
                  <Link href="/tickets?status=ASSIGNED,IN_PROGRESS&assignedToMe=true" className="nav-link flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-[var(--bg-hover)] text-sm text-[var(--text-secondary)]">
                    <div className="flex items-center gap-2"><User className="w-4 h-4 text-violet-500" /><span>{locale === 'ar' ? 'المسندة إليّ' : 'Assigned to Me'}</span></div>
                    {assignedToMe > 0 && <span className="text-[10px] bg-[var(--bg-hover)] text-[var(--text-primary)] px-1.5 py-0.5 rounded-md font-semibold">{assignedToMe}</span>}
                  </Link>
                  <Link href="/tickets?status=OPEN" className="nav-link flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-[var(--bg-hover)] text-sm text-[var(--text-secondary)]">
                    <div className="flex items-center gap-2"><FolderX className="w-4 h-4 text-amber-500" /><span>{locale === 'ar' ? 'غير مسندة' : 'Unassigned'}</span></div>
                    {unassigned > 0 && <span className="text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded-md font-semibold">{unassigned}</span>}
                  </Link>
                  <Link href="/tickets?priority=CRITICAL" className="nav-link flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-[var(--bg-hover)] text-sm text-[var(--text-secondary)]">
                    <div className="flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-red-500" /><span>{locale === 'ar' ? 'حرجة' : 'Critical'}</span></div>
                    {critical > 0 && (
                      <span className="text-[10px] bg-red-500 text-white font-bold px-1.5 py-0.5 rounded-md flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping opacity-75" />
                        {critical}
                      </span>
                    )}
                  </Link>
                </div>
              </div>

              <div>
                <p className="nav-section-label text-[10px] font-bold uppercase tracking-wider mb-2 text-[var(--text-muted)]">{locale === 'ar' ? 'التصنيفات' : 'Categories'}</p>
                <div className="space-y-1">
                  <Link href="/tickets?category=Hardware" className="nav-link flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-[var(--bg-hover)] text-sm text-[var(--text-secondary)]">
                    <div className="flex items-center gap-2"><Monitor className="w-3.5 h-3.5" /><span>{locale === 'ar' ? 'أجهزة ومعدات' : 'Hardware'}</span></div>
                    {hardware > 0 && <span className="text-[10px] text-[var(--text-muted)]">{hardware}</span>}
                  </Link>
                  <Link href="/tickets?category=Software" className="nav-link flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-[var(--bg-hover)] text-sm text-[var(--text-secondary)]">
                    <div className="flex items-center gap-2"><Code className="w-3.5 h-3.5" /><span>{locale === 'ar' ? 'برمجيات وأنظمة' : 'Software'}</span></div>
                    {software > 0 && <span className="text-[10px] text-[var(--text-muted)]">{software}</span>}
                  </Link>
                  <Link href="/tickets?category=Network" className="nav-link flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-[var(--bg-hover)] text-sm text-[var(--text-secondary)]">
                    <div className="flex items-center gap-2"><Wifi className="w-3.5 h-3.5" /><span>{locale === 'ar' ? 'شبكات وإنترنت' : 'Network'}</span></div>
                    {network > 0 && <span className="text-[10px] text-[var(--text-muted)]">{network}</span>}
                  </Link>
                  <Link href="/tickets?category=Email" className="nav-link flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-[var(--bg-hover)] text-sm text-[var(--text-secondary)]">
                    <div className="flex items-center gap-2"><Mail className="w-3.5 h-3.5" /><span>{locale === 'ar' ? 'البريد والتواصل' : 'Email'}</span></div>
                    {email > 0 && <span className="text-[10px] text-[var(--text-muted)]">{email}</span>}
                  </Link>
                  <Link href="/tickets?category=Access Issue" className="nav-link flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-[var(--bg-hover)] text-sm text-[var(--text-secondary)]">
                    <div className="flex items-center gap-2"><Key className="w-3.5 h-3.5" /><span>{locale === 'ar' ? 'الصلاحيات والوصول' : 'Access Issue'}</span></div>
                    {access > 0 && <span className="text-[10px] text-[var(--text-muted)]">{access}</span>}
                  </Link>
                  <Link href="/tickets?category=Printer" className="nav-link flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-[var(--bg-hover)] text-sm text-[var(--text-secondary)]">
                    <div className="flex items-center gap-2"><Printer className="w-3.5 h-3.5" /><span>{locale === 'ar' ? 'الطابعات' : 'Printer'}</span></div>
                    {printer > 0 && <span className="text-[10px] text-[var(--text-muted)]">{printer}</span>}
                  </Link>
                  <Link href="/tickets?category=Other" className="nav-link flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-[var(--bg-hover)] text-sm text-[var(--text-secondary)]">
                    <div className="flex items-center gap-2"><Hash className="w-3.5 h-3.5" /><span>{locale === 'ar' ? 'أخرى' : 'Other'}</span></div>
                    {other > 0 && <span className="text-[10px] text-[var(--text-muted)]">{other}</span>}
                  </Link>
                </div>
              </div>
            </>
          )}

        </nav>

        {/* User footer with availability toggle */}
        <div className="p-4 border-t border-border space-y-3">
          {session?.role === 'IT_SUPPORT' && (
            <AvailabilityToggle initialAvailability={agentAvailability} />
          )}
          <UserDropdown user={{ name: session?.name || 'User', role: session?.role ?? '' }} placement="top" />
        </div>
      </ResponsiveSidebar>

      {/* Main */}
      <main
        className="flex-1 min-w-0 overflow-y-auto pt-14 md:pt-0"
        style={{ background: 'var(--bg-base)' }}
      >
        {/* Critical banner at top of main area */}
        {session?.role === 'IT_SUPPORT' && critical > 0 && (
          <div className="sticky top-0 z-30 flex items-center justify-between gap-3 px-6 py-2.5 bg-rose-50 dark:bg-rose-950/40 text-rose-950 dark:text-rose-200 text-xs font-semibold backdrop-blur-sm border-b border-rose-200 dark:border-rose-900/50 shadow-sm">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 animate-bounce text-rose-600 dark:text-rose-400" />
              <span>
                {locale === 'ar' ? `⚡ ${critical} بلاغ حرج — يتطلب استجابة فورية` : `⚡ ${critical} Critical Incident${critical > 1 ? 's' : ''} — Immediate Response Required`}
              </span>
            </div>
            <Link
              href="/tickets?priority=CRITICAL"
              className="shrink-0 px-3.5 py-1.5 rounded-full bg-rose-600 hover:bg-rose-700 dark:bg-rose-500/20 dark:hover:bg-rose-500/30 transition-colors text-white dark:text-rose-200 text-xs font-medium shadow-xs dark:shadow-none border border-transparent dark:border-rose-700/40"
            >
              {locale === 'ar' ? 'عرض الآن ←' : 'View Now →'}
            </Link>
          </div>
        )}
        {children}
      </main>
    </div>
  )
}
