'use server'

import { randomBytes } from 'crypto'
import bcrypt from 'bcryptjs'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { requireAdmin } from '@/app/actions/auth'

export type AccountStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED' | 'INVITED'

const VALID_SKILLS = ['Hardware', 'Software', 'Network', 'Email', 'Access Issue', 'Printer', 'Security', 'Other']

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

// ─── Update IT Support Agent Skills ───────────────────────────────────────────
export async function updateUserSkills(
  userId: string,
  skills: string[],
): Promise<{ error?: string }> {
  await requireAdmin()

  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) return { error: 'User not found.' }

  const sanitised = skills.filter((s) => VALID_SKILLS.includes(s))

  await prisma.user.update({
    where: { id: userId },
    data: { skills: JSON.stringify(sanitised) },
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
    skills: role === 'IT_SUPPORT' ? JSON.stringify(skills.filter((s) => VALID_SKILLS.includes(s))) : '[]',
  }

  await prisma.user.update({
    where: { id: userId },
    data: dataToUpdate,
  })

  revalidatePath('/admin/users')
  return {}
}

// ─── Invite User ─────────────────────────────────────────────────────────────
export async function inviteUser(
  email: string,
  role: 'EMPLOYEE' | 'IT_SUPPORT' | 'ADMIN',
): Promise<{ error?: string, success?: boolean }> {
  await requireAdmin()

  if (!email || !email.includes('@')) {
    return { error: 'Invalid email address.' }
  }

  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } })
  if (existing) {
    return { error: 'A user with this email already exists.' }
  }

  // Generate a random temporary password since password is required
  const tempPassword = randomBytes(16).toString('hex')
  const hashedPassword = await bcrypt.hash(tempPassword, 12)

  await prisma.user.create({
    data: {
      name: 'Invited User', // Placeholder name
      email: email.toLowerCase(),
      password: hashedPassword,
      role,
      accountStatus: 'INVITED',
      skills: '[]',
      isAvailable: true,
    },
  })

  revalidatePath('/admin/users')
  return { success: true }
}
