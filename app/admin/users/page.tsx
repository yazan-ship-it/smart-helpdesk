import { prisma } from '@/lib/db'
import { getAppSettings, parseCategories } from '@/lib/settings'
import AdminUsersClient from './AdminUsersClient'
import { requireAdmin } from '@/lib/auth'

export const metadata = { title: 'User Management | Admin' }

const ACCOUNT_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED', 'INVITED']

export default async function AdminUsersPage(props: { searchParams: Promise<{ status?: string }> }) {
  // Checked here too: a layout's check does not run again on client-side navigation
  const admin = await requireAdmin()
  const { status } = await props.searchParams
  const initialStatus = status && ACCOUNT_STATUSES.includes(status) ? status : ''
  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      accountStatus: true,
      skills: true,
      isAvailable: true,
      createdAt: true,
      lastLoginAt: true,
      _count: {
        select: {
          createdTickets: true,
          assignedTickets: { where: { status: { in: ['RESOLVED', 'CLOSED'] } } },
        },
      },
    },
  })

  const counts = {
    total: users.length,
    pending: users.filter((u) => u.accountStatus === 'PENDING').length,
    approved: users.filter((u) => u.accountStatus === 'APPROVED').length,
    rejected: users.filter((u) => u.accountStatus === 'REJECTED').length,
    suspended: users.filter((u) => u.accountStatus === 'SUSPENDED').length,
    invited: users.filter((u) => u.accountStatus === 'INVITED').length,
  }

  return (
    <AdminUsersClient
      // Remount when the sidebar link changes ?status=, so the filter follows the URL
      key={initialStatus}
      initialStatus={initialStatus}
      currentUserId={admin.userId}
      users={users.map((u) => ({
        ...u,
        createdAt: u.createdAt.toISOString(),
        lastLoginAt: u.lastLoginAt ? u.lastLoginAt.toISOString() : null,
        stats: u._count,
      }))}
      counts={counts}
      categories={parseCategories((await getAppSettings())?.categoriesList)}
    />
  )
}
