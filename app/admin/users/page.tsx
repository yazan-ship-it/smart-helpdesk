import { prisma } from '@/lib/db'
import AdminUsersClient from './AdminUsersClient'

export const metadata = { title: 'User Management | Admin' }

export default async function AdminUsersPage() {
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
          assignedTickets: { where: { status: 'RESOLVED' } },
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
      users={users.map((u) => ({
        ...u,
        createdAt: u.createdAt.toISOString(),
        lastLoginAt: u.lastLoginAt ? u.lastLoginAt.toISOString() : null,
        stats: u._count,
      }))}
      counts={counts}
    />
  )
}
