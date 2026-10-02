'use server'

import bcrypt from 'bcryptjs'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { MIN_PASSWORD_LENGTH } from '@/lib/passwords'
import { createSession, getSession } from '@/lib/session'

export type ChangePasswordError = 'unauthorized' | 'wrong_current' | 'too_short' | 'mismatch' | 'same_as_current'
export type ChangePasswordState = { error?: ChangePasswordError; success?: boolean } | undefined

export async function changePassword(_prev: ChangePasswordState, formData: FormData): Promise<ChangePasswordState> {
  const session = await getSession()
  if (!session) return { error: 'unauthorized' }

  const current = String(formData.get('currentPassword') ?? '')
  const next = String(formData.get('newPassword') ?? '')
  const confirm = String(formData.get('confirmPassword') ?? '')

  const user = await prisma.user.findUnique({ where: { id: session.userId } })
  if (!user) return { error: 'unauthorized' }
  if (!(await bcrypt.compare(current, user.password))) return { error: 'wrong_current' }
  if (next.length < MIN_PASSWORD_LENGTH) return { error: 'too_short' }
  if (next !== confirm) return { error: 'mismatch' }
  if (next === current) return { error: 'same_as_current' }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: await bcrypt.hash(next, 12),
      // An invited account becomes a normal one once its owner picks a password
      ...(user.accountStatus === 'INVITED' ? { accountStatus: 'APPROVED' } : {}),
    },
  })

  if (!session.mustChangePassword) return { success: true }

  // First sign-in: re-issue the session without the flag and continue to the app
  await createSession(
    { userId: user.id, role: session.role, name: user.name, email: user.email },
    { remember: false },
  )
  redirect(session.role === 'ADMIN' ? '/admin/users' : '/tickets')
}
