'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Users, Shield, Settings, AlertCircle, User, CheckCircle2 } from 'lucide-react'
import { useTranslation } from '@/lib/i18n'

// Define the types from the Prisma queries passed down
type PendingUser = {
  id: string
  name: string
  email: string
}

type SlaBreachTicket = {
  id: string
  ticketNumber: number
  title: string
  slaDeadline: Date | null
}

type SidebarNavProps = {
  pendingApprovalsCount?: number
  slaBreachesCount?: number
  pendingApprovals?: PendingUser[]
  slaBreaches?: SlaBreachTicket[]
}

export default function SidebarNav({
  pendingApprovalsCount = 0,
  slaBreachesCount = 0,
  pendingApprovals = [],
  slaBreaches = []
}: SidebarNavProps) {
  const pathname = usePathname()
  const { t, locale } = useTranslation()

  const items = [
    { href: '/admin/users', label: t('nav.userManagement'), icon: Users },
    { href: '/admin/tickets', label: t('nav.allTickets'), icon: Shield },
    { href: '/admin/settings', label: t('nav.settings'), icon: Settings },
  ]

  // Time formatting helper with locale awareness
  const getElapsedString = (date: Date | null | string) => {
    if (!date) return ''
    const parsedDate = new Date(date)
    const ms = new Date().getTime() - parsedDate.getTime()
    const hours = Math.floor(ms / (1000 * 60 * 60))
    const mins = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60))
    const dUnit = locale === 'ar' ? 'ي' : 'd'
    const hUnit = locale === 'ar' ? 'س' : 'h'
    const mUnit = locale === 'ar' ? 'د' : 'm'

    if (hours >= 24) return `-${Math.floor(hours/24)}${dUnit} ${hours % 24}${hUnit}`
    if (hours > 0) return `-${hours}${hUnit} ${mins}${mUnit}`
    return `-${mins}${mUnit}`
  }

  return (
    <nav className="flex-1 p-4 space-y-8">
      {/* MANAGEMENT GROUP */}
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-3 py-1 mb-2">
          {t('nav.management')}
        </p>

        <div className="space-y-1">
          {items.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)
            
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-[15px] font-medium transition-colors ${
                  isActive
                    ? 'bg-[var(--bg-hover)] text-foreground'
                    : 'text-muted-foreground hover:bg-[var(--bg-hover)] hover:text-foreground'
                }`}
              >
                <Icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-indigo-400' : ''}`} />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </div>
      </div>

      {/* MONITORING GROUP */}
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-3 py-1 mb-2">
          {t('nav.operationalQueues')}
        </p>

        <div className="space-y-2">
          
          {/* Pending Approvals Hover-Card */}
          <div className="relative group cursor-pointer">
            <Link
              href="/admin/users?status=PENDING"
              className="flex items-center justify-between w-full py-2.5 px-3 rounded-lg hover:bg-accent/60 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Users className="w-5 h-5 shrink-0 text-muted-foreground group-hover:text-amber-500 transition-colors" />
                <span className="text-[15px] font-medium text-muted-foreground group-hover:text-foreground transition-colors whitespace-nowrap">
                  {t('nav.pendingApprovals')}
                </span>
              </div>
              {pendingApprovalsCount > 0 && (
                <span className="text-xs px-2 py-0.5 rounded-md font-mono font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  {pendingApprovalsCount}
                </span>
              )}
            </Link>
            
            {/* Hover-Triggered Floating Card */}
            <div className="absolute left-full rtl:left-auto rtl:right-full top-0 ml-3 rtl:ml-0 rtl:mr-3 w-72 p-3.5 bg-popover text-popover-foreground rounded-xl shadow-2xl border border-border z-50 animate-in fade-in zoom-in-95 duration-150 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
              <div className="flex items-center justify-between mb-3 border-b border-border pb-2">
                <span className="font-semibold text-sm">{t('nav.pendingApprovals')}</span>
                <span className="text-[10px] font-mono font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20 px-1.5 py-0.5 rounded">{pendingApprovalsCount}</span>
              </div>
              {pendingApprovalsCount === 0 ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground italic px-2 py-1">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  {locale === 'ar' ? 'لا توجد طلبات معلقة' : 'No pending registrations'}
                </div>
              ) : (
                <div className="space-y-1">
                  {pendingApprovals.map(user => (
                    <Link 
                      key={user.id} 
                      href={`/admin/users?highlight=${user.id}`}
                      className="flex items-center gap-3 p-2 rounded-md hover:bg-accent/60 transition-colors"
                    >
                      <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center shrink-0 border border-border">
                        <User className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate">{user.name}</p>
                        <p className="text-xs text-amber-600 dark:text-amber-500 truncate">
                          {locale === 'ar' ? 'بانتظار الاعتماد' : 'Pending approval'}
                        </p>
                      </div>
                    </Link>
                  ))}
                  <Link 
                    href="/admin/users?status=PENDING"
                    className="block text-xs font-medium text-indigo-500 hover:text-indigo-600 mt-2 p-2 hover:underline"
                  >
                    {locale === 'ar' ? 'عرض واعتماد كافة المستخدمين ←' : 'View all pending in Users →'}
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* SLA Breaches Hover-Card */}
          <div className="relative group cursor-pointer">
            <Link
              href="/admin/tickets?filter=sla_breached"
              className="flex items-center justify-between w-full py-2.5 px-3 rounded-lg hover:bg-accent/60 transition-colors"
            >
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 shrink-0 text-muted-foreground group-hover:text-red-500 transition-colors" />
                <span className="text-[15px] font-medium text-muted-foreground group-hover:text-foreground transition-colors whitespace-nowrap">
                  {t('nav.slaBreaches')}
                </span>
              </div>
              {slaBreachesCount > 0 && (
                <span className="text-xs px-2 py-0.5 rounded-md font-mono font-bold bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20">
                  {slaBreachesCount}
                </span>
              )}
            </Link>
            
            {/* Hover-Triggered Floating Card */}
            <div className="absolute left-full rtl:left-auto rtl:right-full top-0 ml-3 rtl:ml-0 rtl:mr-3 w-72 p-3.5 bg-popover text-popover-foreground rounded-xl shadow-2xl border border-border z-50 animate-in fade-in zoom-in-95 duration-150 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
              <div className="flex items-center justify-between mb-3 border-b border-border pb-2">
                <span className="font-semibold text-sm">{t('nav.slaBreaches')}</span>
                <span className="text-[10px] font-mono font-bold bg-red-500/10 text-red-600 border border-red-500/20 px-1.5 py-0.5 rounded">{slaBreachesCount}</span>
              </div>
              {slaBreachesCount === 0 ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground italic px-2 py-1">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  {locale === 'ar' ? 'كافة التذاكر ضمن المستهدف الزمني' : 'All SLAs within targets'}
                </div>
              ) : (
                <div className="space-y-1">
                  {slaBreaches.map(ticket => (
                    <Link 
                      key={ticket.id} 
                      href={`/admin/tickets/${ticket.id}`}
                      className="flex items-center gap-3 p-2 rounded-md hover:bg-accent/60 transition-colors"
                    >
                      <div className="w-8 h-8 rounded-md bg-red-500/10 flex items-center justify-center shrink-0 border border-red-500/20">
                        <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-mono font-medium text-foreground truncate">#{ticket.ticketNumber}</p>
                        <p className="text-sm text-muted-foreground truncate">{ticket.title}</p>
                      </div>
                      <div className="shrink-0">
                        <p className="text-xs font-bold text-red-600 dark:text-red-400 whitespace-nowrap bg-red-500/10 px-1.5 py-0.5 rounded border border-red-500/20">{getElapsedString(ticket.slaDeadline)}</p>
                      </div>
                    </Link>
                  ))}
                  <Link 
                    href="/admin/tickets?filter=sla_breached"
                    className="block text-xs font-medium text-indigo-500 hover:text-indigo-600 mt-2 p-2 hover:underline"
                  >
                    {locale === 'ar' ? 'عرض كافة التجاوزات ←' : 'View all breached tickets →'}
                  </Link>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </nav>
  )
}
