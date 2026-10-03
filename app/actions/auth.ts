'use server'

import bcrypt from 'bcryptjs'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { createSession, deleteSession, type Role } from '@/lib/session'
import {
  clearAttempts,
  clientAddress,
  LOGIN_PER_ACCOUNT,
  LOGIN_PER_ADDRESS,
  recordAttempt,
  REGISTER_PER_ADDRESS,
  retryAfter,
} from '@/lib/rate-limit'
import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from '@/lib/passwords'

/**
 * Compared against when the email is unknown, so a failed sign-in takes as long
 * whether or not the account exists (bcrypt is the slow part). Same cost as real hashes.
 */
const DUMMY_PASSWORD_HASH = '$2b$12$F1IhPoWwdRPE23ZWJFjbv.9/RDACL4MJLGO8fhQaOrXMNX2rY6c2a'

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
  error?: 'too_many_attempts'
  retryAfterMinutes?: number
  /** The form shows auth.registerErrors.<field> for each flagged field */
  fieldErrors?: Partial<Record<'name' | 'email' | 'password' | 'role', true>>
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
  // Same error, and the same time, for an unknown email and a wrong password,
  // so accounts can't be enumerated
  const passwordOk = await bcrypt.compare(password, user?.password ?? DUMMY_PASSWORD_HASH)
  if (!user || !passwordOk) {
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
  const name = String(formData.get('name') ?? '').trim()
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  const password = String(formData.get('password') ?? '')
  const role = String(formData.get('role') ?? '').trim()

  const fieldErrors: NonNullable<RegisterState>['fieldErrors'] = {}

  if (name.length < 2 || name.length > 100) fieldErrors.name = true
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) fieldErrors.email = true
  if (password.length < MIN_PASSWORD_LENGTH || password.length > MAX_PASSWORD_LENGTH) fieldErrors.password = true
  if (!['EMPLOYEE', 'IT_SUPPORT'].includes(role)) fieldErrors.role = true

  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors }
  }

  // Slow down scripted sign-ups
  const addressKey = `register:address:${await clientAddress()}`
  const wait = await retryAfter(addressKey, REGISTER_PER_ADDRESS)
  if (wait > 0) return { error: 'too_many_attempts', retryAfterMinutes: Math.ceil(wait / 60_000) }
  await recordAttempt(addressKey, REGISTER_PER_ADDRESS)

  // Hash first: an existing email then gets the same answer, after the same time,
  // as a new one, so the form can't be used to find out who has an account
  const hashedPassword = await bcrypt.hash(password, 12)
  const [existing, settings] = await Promise.all([
    prisma.user.findUnique({ where: { email } }),
    prisma.appSettings.findUnique({ where: { id: 'singleton' } }),
  ])
  if (existing) return { success: true }

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
