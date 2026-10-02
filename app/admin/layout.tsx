import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { cookies } from 'next/headers'
import { LifeBuoy, Shield, Zap, Database } from 'lucide-react'
import ThemeSwitcher from '@/app/components/ThemeSwitcher'
import UserDropdown from '@/app/components/UserDropdown'
import SidebarNav from '@/app/components/SidebarNav'
import { getRoleLabel } from '@/lib/roles'
import { prisma } from '@/lib/db'
import { getBrandName } from '@/lib/brand'
import { isAiConfigured } from '@/lib/gemini'
import { checkDatabase } from '@/lib/health'
import { getAppSettings } from '@/lib/settings'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  const cookieStore = await cookies()
  const locale = (cookieStore.get('helpdesk-lang')?.value === 'ar' ? 'ar' : 'en') as 'en' | 'ar'

  if (!session || session.role !== 'ADMIN') {
    redirect('/login')
  }

  const settings = await getAppSettings()
  const brandName = getBrandName(settings?.appName, locale)

  // Real health checks: time a trivial query, and report the AI configuration as it is
  const { ok: dbOk, latencyMs: dbLatencyMs } = await checkDatabase()
  const aiState = !isAiConfigured() ? 'missing' : settings && !settings.enableAiTriage ? 'disabled' : 'configured'

  const pendingApprovals = await prisma.user.findMany({
    where: { accountStatus: 'PENDING' },
    select: { id: true, name: true, email: true },
    orderBy: { createdAt: 'desc' },
    take: 4
  })
  const pendingApprovalsCount = await prisma.user.count({
    where: { accountStatus: 'PENDING' }
  })
  
  const slaBreaches = await prisma.ticket.findMany({
    where: {
      status: { notIn: ['RESOLVED', 'CLOSED'] },
      slaDeadline: { lt: new Date() }
    },
    select: { id: true, ticketNumber: true, title: true, slaDeadline: true },
    orderBy: { slaDeadline: 'asc' },
    take: 4
  })
  const slaBreachesCount = await prisma.ticket.count({
    where: {
      status: { notIn: ['RESOLVED', 'CLOSED'] },
      slaDeadline: { lt: new Date() }
    }
  })

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg-base)' }}>
      {/* Sidebar */}
      <aside className="flex flex-col w-60 border-r rtl:border-r-0 rtl:border-l border-[var(--border)] bg-[var(--bg-elevated)] h-full shrink-0">
        {/* Brand */}
        <div className="p-4 flex items-center gap-3 border-b border-[var(--border)] shrink-0 overflow-hidden whitespace-nowrap">
          <LifeBuoy className="w-7 h-7 text-indigo-500 shrink-0" />
          <div className="min-w-0 shrink-0 whitespace-nowrap">
            <p className="text-base font-extrabold tracking-tight text-foreground truncate whitespace-nowrap">
              {brandName}
            </p>
            <p className="text-[10px] text-muted-foreground truncate whitespace-nowrap">
              {locale === 'ar' ? 'لوحة تحكم المدير' : 'Admin Console'}
            </p>
          </div>
        </div>

        {/* Nav */}
        <SidebarNav 
          pendingApprovalsCount={pendingApprovalsCount} 
          slaBreachesCount={slaBreachesCount}
          pendingApprovals={pendingApprovals}
          slaBreaches={slaBreaches}
        />

        {/* System & AI Health Widget */}
        <div className="px-3 pb-3">
          <div className="bg-muted/40 dark:bg-muted/20 rounded-xl p-3 border border-border text-xs space-y-2">
            <div className="flex items-center gap-2">
              <Database className={`w-3.5 h-3.5 shrink-0 ${dbOk ? 'text-emerald-500' : 'text-red-500'}`} />
              <span className="text-muted-foreground font-medium">
                {dbOk
                  ? locale === 'ar' ? `قاعدة البيانات: متصلة (${dbLatencyMs} ms)` : `Database: connected (${dbLatencyMs} ms)`
                  : locale === 'ar' ? 'قاعدة البيانات: لا يوجد اتصال' : 'Database: unreachable'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Zap className={`w-3.5 h-3.5 shrink-0 ${aiState === 'configured' ? 'text-amber-500' : 'text-muted-foreground'}`} />
              <span className="text-muted-foreground font-medium">
                {aiState === 'configured'
                  ? locale === 'ar' ? 'الذكاء الاصطناعي: مفعّل' : 'AI: configured'
                  : aiState === 'disabled'
                    ? locale === 'ar' ? 'الذكاء الاصطناعي: معطّل من الإعدادات' : 'AI: turned off in Settings'
                    : locale === 'ar' ? 'الذكاء الاصطناعي: لا يوجد مفتاح API' : 'AI: no API key set'}
              </span>
            </div>
          </div>
        </div>

        {/* Footer: user dropdown */}
        <div className="p-3 border-t border-[var(--border)]">
          <UserDropdown user={{ name: session.name, role: session.role }} placement="top" />
        </div>
      </aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex items-center justify-between px-6 py-3 border-b border-[var(--border)] bg-[var(--bg-elevated)] shrink-0">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-indigo-500" />
            <span className="text-sm font-semibold text-foreground">
              {locale === 'ar' ? 'لوحة تحكم المدير' : 'Admin Console'}
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 font-mono font-medium">
              {getRoleLabel('ADMIN', locale)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeSwitcher />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6" style={{ background: 'var(--bg-base)' }}>
          {children}
        </main>
      </div>
    </div>
  )
}
