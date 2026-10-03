import 'server-only'
import { redirect } from 'next/navigation'
import { getSession, type SessionPayload } from '@/lib/session'

/*
 * Guards for pages and server actions. They live outside 'use server' files on
 * purpose: every export of such a file is a public endpoint the browser can call.
 */

/** The signed-in user, or a redirect to the login page */
export async function requireAuth(): Promise<SessionPayload> {
  const session = await getSession()
  if (!session) redirect('/login')
  return session
}

/** The signed-in admin; anyone else is sent to their tickets */
export async function requireAdmin(): Promise<SessionPayload> {
  const session = await requireAuth()
  if (session.role !== 'ADMIN') redirect('/tickets')
  return session
}
