'use server'

import bcrypt from 'bcryptjs'
import { generateTemporaryPassword } from '@/lib/passwords'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { requireAdmin } from '@/app/actions/auth'
import { getAppSettings, parseCategories } from '@/lib/settings'
import { sanitizeSkills } from '@/lib/skills'

export type AccountStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED' | 'INVITED'


// ─── Update User Account Status (Approve / Reject / Suspend) ────────────────────────────
export async function updateUserStatus(
  userId: string,
  status: AccountStatus,
): Promise<{ error?: string }> {
  await requireAdmin()

  if (!['APPROVED', 'REJECTED', 'PENDING', 'SUSPENDED'].includes(status)) {
    return { error: 'Invalid status value.' }
  }

  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) return { error: 'User not found.' }

  await prisma.user.update({
    where: { id: userId },
    data: { accountStatus: status },
  })

  revalidatePath('/admin/users')
  return {}
}

// ─── Bulk Update User Account Status ──────────────────────────────────────────
export async function bulkUpdateUserStatus(
  userIds: string[],
  status: 'APPROVED' | 'REJECTED',
): Promise<{ error?: string }> {
  await requireAdmin()

  if (!['APPROVED', 'REJECTED'].includes(status)) {
    return { error: 'Invalid status value.' }
  }
  
  if (!userIds || userIds.length === 0) {
    return { error: 'No users selected.' }
  }

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
): Promise<{ error?: string }> {
  await requireAdmin()

  if (!['EMPLOYEE', 'IT_SUPPORT', 'ADMIN'].includes(role)) {
    return { error: 'Invalid role.' }
  }

  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) return { error: 'User not found.' }

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
}): Promise<{ error?: string; tempPassword?: string }> {
  await requireAdmin()

  const name = input.name?.trim()
  const email = input.email?.trim().toLowerCase()
  if (!name || name.length < 2) return { error: 'Please enter the name of the person.' }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'Invalid email address.' }
  if (!INVITE_ROLES.includes(input.role)) return { error: 'Invalid role.' }

  if (await prisma.user.findUnique({ where: { email } })) {
    return { error: 'A user with this email already exists.' }
  }

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
