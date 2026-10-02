'use server'

import bcrypt from 'bcryptjs'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { createSession, deleteSession, getSession, type Role } from '@/lib/session'
import { clearAttempts, clientAddress, LOGIN_PER_ACCOUNT, LOGIN_PER_ADDRESS, recordAttempt, retryAfter } from '@/lib/rate-limit'

/** Error codes; the login page shows them in the user's language */
export type LoginError =
  | 'missing_fields'
  | 'invalid_credentials'
  | 'too_many_attempts'
  | 'pending'
  | 'rejected'
  | 'suspended'
  | 'maintenance'

export type AuthState = {
  error?: LoginError
  /** With too_many_attempts */
  retryAfterMinutes?: number
} | undefined

export type RegisterState = {
  error?: string
  fieldErrors?: {
    name?: string[]
    email?: string[]
    password?: string[]
    role?: string[]
  }
  success?: boolean
} | undefined

// ─── Login ────────────────────────────────────────────────────────────────────
export async function login(prevState: AuthState, formData: FormData): Promise<AuthState> {
  const email = (formData.get('email') as string | null)?.trim().toLowerCase()
  const password = formData.get('password') as string | null
  const remember = formData.get('rememberMe') === 'on'

  if (!email || !password) return { error: 'missing_fields' }

  // Brute-force protection: checked before the password, counted only on failure
  const accountKey = `login:account:${email}`
  const addressKey = `login:address:${await clientAddress()}`
  const wait = Math.max(await retryAfter(accountKey, LOGIN_PER_ACCOUNT), await retryAfter(addressKey, LOGIN_PER_ADDRESS))
  if (wait > 0) return { error: 'too_many_attempts', retryAfterMinutes: Math.ceil(wait / 60_000) }

  const user = await prisma.user.findUnique({ where: { email } })
  // Same error for unknown email and wrong password, so accounts can't be enumerated
  if (!user || !(await bcrypt.compare(password, user.password))) {
    await recordAttempt(accountKey, LOGIN_PER_ACCOUNT)
    await recordAttempt(addressKey, LOGIN_PER_ADDRESS)
    return { error: 'invalid_credentials' }
  }
  await clearAttempts(accountKey)

  if (user.accountStatus === 'PENDING') return { error: 'pending' }
  if (user.accountStatus === 'REJECTED') return { error: 'rejected' }
  if (user.accountStatus === 'SUSPENDED') return { error: 'suspended' }

  const settings = await prisma.appSettings.findUnique({ where: { id: 'singleton' }, select: { maintenanceMode: true } })
  if (settings?.maintenanceMode && user.role !== 'ADMIN') return { error: 'maintenance' }

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  })

  const mustChangePassword = user.accountStatus === 'INVITED'
  await createSession(
    { userId: user.id, role: user.role as Role, name: user.name, email: user.email, mustChangePassword, sessionVersion: user.sessionVersion },
    { remember },
  )

  if (mustChangePassword) redirect('/account/password')
  if (user.role === 'ADMIN') redirect('/admin/users')
  if (user.role === 'IT_SUPPORT') redirect('/tickets?queue=assigned_to_me')
  redirect('/tickets')
}

// ─── Register ─────────────────────────────────────────────────────────────────
export async function register(prevState: RegisterState, formData: FormData): Promise<RegisterState> {
  const name = (formData.get('name') as string)?.trim()
  const email = (formData.get('email') as string)?.trim().toLowerCase()
  const password = formData.get('password') as string
  const role = (formData.get('role') as string)?.trim()

  const fieldErrors: NonNullable<RegisterState>['fieldErrors'] = {}

  if (!name || name.length < 2) fieldErrors.name = ['Full name must be at least 2 characters.']
  if (!email || !email.includes('@')) fieldErrors.email = ['A valid email address is required.']
  if (!password || password.length < 8) fieldErrors.password = ['Password must be at least 8 characters.']
  if (!role || !['EMPLOYEE', 'IT_SUPPORT'].includes(role)) fieldErrors.role = ['Please select a valid role.']

  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors }
  }

  // Check for duplicate email
  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    return { fieldErrors: { email: ['An account with this email already exists.'] } }
  }

  const hashedPassword = await bcrypt.hash(password, 12)

  const settings = await prisma.appSettings.findUnique({ where: { id: 'singleton' } })
  const autoApproveDomain = settings?.autoApproveDomain || '@company.com'
  const isAutoApprove = email.endsWith(autoApproveDomain) && role === 'EMPLOYEE'
  const accountStatus = isAutoApprove ? 'APPROVED' : 'PENDING'

  await prisma.user.create({
    data: {
      name,
      email,
      password: hashedPassword,
      role,
      accountStatus,
      skills: '[]',
      isAvailable: true,
    },
  })

  return { success: true }
}

// ─── Logout ───────────────────────────────────────────────────────────────────
export async function logout(): Promise<void> {
  await deleteSession()
  redirect('/login')
}

// ─── Auth Helpers ─────────────────────────────────────────────────────────────
export async function requireAuth() {
  const session = await getSession()
  if (!session) {
    redirect('/login')
  }
  return session
}

export async function requireRole(role: 'IT_SUPPORT' | 'EMPLOYEE') {
  const session = await requireAuth()
  if (session.role !== role) {
    redirect('/tickets')
  }
  return session
}

export async function requireAdmin() {
  const session = await requireAuth()
  if (session.role !== 'ADMIN') {
    redirect('/tickets')
  }
  return session
}
