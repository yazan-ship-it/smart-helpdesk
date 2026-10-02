'use server'

import bcrypt from 'bcryptjs'
import { generateTemporaryPassword } from '@/lib/passwords'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { requireAdmin } from '@/app/actions/auth'
import { getAppSettings, parseCategories } from '@/lib/settings'
import { sanitizeSkills } from '@/lib/skills'
import { fail, type ActionResult } from '@/lib/errors'

export type AccountStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED' | 'INVITED'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const NAME_MAX = 100

// ─── Update User Account Status (Approve / Reject / Suspend) ────────────────────────────
export async function updateUserStatus(userId: string, status: AccountStatus): Promise<ActionResult> {
  const admin = await requireAdmin()

  if (!['APPROVED', 'REJECTED', 'PENDING', 'SUSPENDED'].includes(status)) return fail('invalid_status')
  // An admin could otherwise lock themselves (or the last admin) out
  if (userId === admin.userId) return fail('cannot_change_self')

  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) return fail('not_found')

  await prisma.user.update({
    where: { id: userId },
    data: { accountStatus: status },
  })

  revalidatePath('/admin/users')
  return {}
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
): Promise<ActionResult> {
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

  await prisma.user.update({
    where: { id: userId },
    data: dataToUpdate,
  })

  revalidatePath('/admin/users')
  return {}
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
