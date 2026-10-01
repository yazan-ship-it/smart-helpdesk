import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/db'
import SettingsClient from './SettingsClient'

export const metadata = {
  title: 'Settings',
  description: 'Manage application configuration and defaults',
}

export default async function SettingsPage() {
  const session = await getSession()
  const cookieStore = await cookies()
  const locale = (cookieStore.get('helpdesk-lang')?.value === 'ar' ? 'ar' : 'en') as 'en' | 'ar'

  if (!session || session.role !== 'ADMIN') {
    redirect('/login')
  }

  const initialSettings = await prisma.appSettings.findUnique({
    where: { id: 'singleton' }
  })

  const agents = await prisma.user.findMany({
    where: {
      role: 'IT_SUPPORT',
      accountStatus: 'APPROVED'
    },
    select: {
      id: true,
      name: true,
      email: true,
      skills: true
    },
    orderBy: {
      name: 'asc'
    }
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
          {locale === 'ar' ? 'الإعدادات' : 'Settings'}
        </h1>
        <p className="text-base font-normal text-muted-foreground/90 mt-1.5">
          {locale === 'ar'
            ? 'إدارة إعدادات النظام، القيم الافتراضية، والإشعارات'
            : 'Manage system configurations, defaults, and notifications.'}
        </p>
      </div>

      <SettingsClient initialSettings={initialSettings} agents={agents} />
    </div>
  )
}

