import 'server-only'
import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import { cache } from 'react'
import { checkSession } from '@/lib/session-check'

export type Role = 'EMPLOYEE' | 'IT_SUPPORT' | 'ADMIN'

export type SessionPayload = {
  userId: string
  role: Role
  name: string
  email: string
  /** Invited users signed in with a temporary password and must set their own first */
  mustChangePassword?: boolean
  /** Must match User.sessionVersion; bumping it signs the user out everywhere */
  sessionVersion: number
  /** Signed in with "remember me" */
  remember?: boolean
  expiresAt: Date
}

const secretKey = process.env.SESSION_SECRET
if (!secretKey || secretKey.length < 32) {
  throw new Error('SESSION_SECRET must be set to a random value of at least 32 characters')
}
const encodedKey = new TextEncoder().encode(secretKey)

export const SESSION_COOKIE = 'helpdesk-session'
/** "Remember me": a persistent cookie for 30 days */
const REMEMBER_DURATION = 30 * 24 * 60 * 60 * 1000
/** Otherwise: a browser-session cookie, and the token itself expires after a working day */
const SESSION_DURATION = 12 * 60 * 60 * 1000

export async function encrypt(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(new Date(payload.expiresAt))
    .sign(encodedKey)
}

export async function decrypt(session: string | undefined): Promise<SessionPayload | null> {
  if (!session) return null
  try {
    const { payload } = await jwtVerify(session, encodedKey, {
      algorithms: ['HS256'],
    })
    return payload as unknown as SessionPayload
  } catch {
    return null
  }
}

export async function createSession(
  payload: Omit<SessionPayload, 'expiresAt' | 'remember'>,
  { remember }: { remember: boolean },
): Promise<void> {
  const expiresAt = new Date(Date.now() + (remember ? REMEMBER_DURATION : SESSION_DURATION))
  const session = await encrypt({ ...payload, remember, expiresAt })
  const cookieStore = await cookies()

  cookieStore.set(SESSION_COOKIE, session, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    // Without "remember me" there is no expiry, so the browser drops the cookie when it closes
    ...(remember ? { expires: expiresAt } : {}),
    sameSite: 'lax',
    path: '/',
  })
}

export async function deleteSession(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE)
}

/**
 * The signed-in user, checked against the database (see lib/session-check.ts).
 * Cached for the duration of one request.
 */
export const getSession = cache(async (): Promise<SessionPayload | null> => {
  const cookieStore = await cookies()
  const payload = await decrypt(cookieStore.get(SESSION_COOKIE)?.value)
  if (!payload) return null
  const check = await checkSession(payload)
  return 'session' in check ? check.session : null
})
