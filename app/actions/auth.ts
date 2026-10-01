'use server'

import bcrypt from 'bcryptjs'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { createSession, deleteSession, getSession, type Role } from '@/lib/session'

export type AuthState = {
 error?: string
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
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  if (!email || !password) {
    return { error: 'Email and password are required.' }
  }

  const user = await prisma.user.findUnique({ where: { email } })

  if (!user) {
    return { error: 'Invalid email or password.' }
  }

  const passwordMatch = await bcrypt.compare(password, user.password)

  if (!passwordMatch) {
    return { error: 'Invalid email or password.' }
  }

  // ── Account Status Guard ──────────────────────────────────────────────────
  if (user.accountStatus === 'PENDING') {
    return { error: 'Your account is currently pending Admin approval.' }
  }
  if (user.accountStatus === 'REJECTED') {
    return { error: 'Your account request was rejected. Please contact your administrator.' }
  }
  if (user.accountStatus === 'SUSPENDED') {
    return { error: 'Your account has been suspended. Please contact your administrator.' }
  }

  // Update last login time
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() }
  })

  await createSession({
    userId: user.id,
    role: user.role as Role,
    name: user.name,
    email: user.email,
  })

  if (user.role === 'ADMIN') {
    redirect('/admin/users')
  }
  if (user.role === 'IT_SUPPORT') {
    redirect('/tickets?queue=assigned_to_me')
  }
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
