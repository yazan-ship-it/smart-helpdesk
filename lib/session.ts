import 'server-only'
import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'

export type Role = 'EMPLOYEE' | 'IT_SUPPORT' | 'ADMIN'

export type SessionPayload = {
  userId: string
  role: Role
  name: string
  email: string
  expiresAt: Date
}

const secretKey = process.env.SESSION_SECRET
if (!secretKey) {
  throw new Error('SESSION_SECRET environment variable is not set')
}
const encodedKey = new TextEncoder().encode(secretKey)

const COOKIE_NAME = 'helpdesk-session'
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
  payload: Omit<SessionPayload, 'expiresAt'>,
  { remember }: { remember: boolean },
): Promise<void> {
  const expiresAt = new Date(Date.now() + (remember ? REMEMBER_DURATION : SESSION_DURATION))
  const session = await encrypt({ ...payload, expiresAt })
  const cookieStore = await cookies()

  cookieStore.set(COOKIE_NAME, session, {
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
  cookieStore.delete(COOKIE_NAME)
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies()
  const cookie = cookieStore.get(COOKIE_NAME)
  return decrypt(cookie?.value)
}
