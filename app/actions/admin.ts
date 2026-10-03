'use server'

import bcrypt from 'bcryptjs'
import { generateTemporaryPassword } from '@/lib/passwords'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { requireAdmin } from '@/app/actions/auth'
import { getAppSettings, parseCategories } from '@/lib/settings'
import { sanitizeSkills } from '@/lib/skills'
import { fail, type ActionResult } from '@/lib/errors'
import { historyData } from '@/lib/history'
import type { Prisma } from '@prisma/client'

export type AccountStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED' | 'INVITED'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const NAME_MAX = 100

/** Result of a change that may have freed up an agent's tickets */
export type UserChangeResult = ActionResult & { returnedTickets?: number }

/**
 * An agent who is suspended (or no longer IT support) can't work their tickets,
 * so the unfinished ones go back to the unassigned queue for someone else.
 * Returns how many tickets were moved.
 */
async function returnTicketsToQueue(
  tx: Prisma.TransactionClient,
  agent: { id: string; name: string },
  adminId: string,
  adminName: string,
): Promise<number> {
  const open = await tx.ticket.findMany({
    where: { assignedToId: agent.id, status: { notIn: ['RESOLVED', 'CLOSED'] } },
    select: { id: true },
  })
  if (open.length === 0) return 0
  await tx.ticket.updateMany({
    where: { id: { in: open.map((t) => t.id) } },
    data: { assignedToId: null, status: 'OPEN' },
  })
  await tx.ticketHistory.createMany({
    data: open.map((t) => ({
      ticketId: t.id,
      userId: adminId,
      ...historyData({ type: 'returned_to_queue', agent: agent.name }, adminName),
    })),
  })
  return open.length
}

// ─── Update User Account Status (Approve / Reject / Suspend) ────────────────────────────
export async function updateUserStatus(userId: string, status: AccountStatus): Promise<UserChangeResult> {
  const admin = await requireAdmin()

  if (!['APPROVED', 'REJECTED', 'PENDING', 'SUSPENDED'].includes(status)) return fail('invalid_status')
  // An admin could otherwise lock themselves (or the last admin) out
  if (userId === admin.userId) return fail('cannot_change_self')

  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) return fail('not_found')

  const returnedTickets = await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { accountStatus: status } })
    return status === 'APPROVED' ? 0 : returnTicketsToQueue(tx, user, admin.userId, admin.name)
  })

  revalidatePath('/admin/users')
  revalidatePath('/tickets')
  return returnedTickets ? { returnedTickets } : {}
}

// ─── Bulk Update User Account Status ──────────────────────────────────────────
export async function bulkUpdateUserStatus(userIds: string[], status: 'APPROVED' | 'REJECTED'): Promise<ActionResult> {
  await requireAdmin()

  if (!['APPROVED', 'REJECTED'].includes(status)) return fail('invalid_status')
  if (!Array.isArray(userIds) || userIds.length === 0) return fail('no_users_selected')

  // Only pending requests are decided here
  await prisma.user.updateMany({
    where: { id: { in: userIds }, accountStatus: 'PENDING' },
    data: { accountStatus: status },
  })

  revalidatePath('/admin/users')
  return {}
}

// ─── Update User Role (and skills) ───────────────────────────────────────────
export async function updateUserRole(
  userId: string,
  role: 'EMPLOYEE' | 'IT_SUPPORT' | 'ADMIN',
  skills: string[] = [],
): Promise<UserChangeResult> {
  const admin = await requireAdmin()

  if (!['EMPLOYEE', 'IT_SUPPORT', 'ADMIN'].includes(role)) return fail('invalid_role')

  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) return fail('not_found')
  if (userId === admin.userId && role !== 'ADMIN') return fail('cannot_change_self')

  const dataToUpdate = {
    role,
    // Clear skills if not IT Support
    skills: role === 'IT_SUPPORT' ? JSON.stringify(sanitizeSkills(skills, parseCategories((await getAppSettings())?.categoriesList))) : '[]',
  }

  const returnedTickets = await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: dataToUpdate })
    return role === 'IT_SUPPORT' ? 0 : returnTicketsToQueue(tx, user, admin.userId, admin.name)
  })

  revalidatePath('/admin/users')
  revalidatePath('/tickets')
  return returnedTickets ? { returnedTickets } : {}
}

// ─── Invite User ─────────────────────────────────────────────────────────────
const INVITE_ROLES = ['EMPLOYEE', 'IT_SUPPORT', 'ADMIN'] as const

/**
 * Create an account with a one-time password. There is no email service yet,
 * so the password is returned once for the admin to share; the user must
 * replace it on first sign-in.
 */
export async function inviteUser(input: {
  name: string
  email: string
  role: (typeof INVITE_ROLES)[number]
}): Promise<ActionResult & { tempPassword?: string }> {
  await requireAdmin()

  const name = typeof input.name === 'string' ? input.name.trim() : ''
  const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : ''
  if (name.length < 2 || name.length > NAME_MAX) return fail('name_required')
  if (!EMAIL.test(email) || email.length > 254) return fail('invalid_email')
  if (!INVITE_ROLES.includes(input.role)) return fail('invalid_role')

  if (await prisma.user.findUnique({ where: { email } })) return fail('email_taken')

  const tempPassword = generateTemporaryPassword()
  await prisma.user.create({
    data: {
      name,
      email,
      password: await bcrypt.hash(tempPassword, 12),
      role: input.role,
      accountStatus: 'INVITED',
      skills: '[]',
      isAvailable: true,
    },
  })

  revalidatePath('/admin/users')
  return { tempPassword }
}
