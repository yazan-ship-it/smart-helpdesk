import { prisma } from '@/lib/db'
import type { Role, SessionPayload } from '@/lib/session'

/** Why a signed session cookie is no longer accepted; shown on the login page */
export type SessionEndReason = 'session_ended' | 'pending' | 'rejected' | 'suspended' | 'maintenance'

export const SESSION_END_REASONS: readonly SessionEndReason[] = ['session_ended', 'pending', 'rejected', 'suspended', 'maintenance']

export type SessionCheck = { session: SessionPayload } | { ended: SessionEndReason }

/**
 * A session cookie only proves who signed in and when. Check it against the
 * database on every request so that suspending a user, changing their role or
 * their password, or turning on maintenance mode takes effect immediately.
 * Role, name and email are taken from the database, not from the cookie.
 */
export async function checkSession(payload: SessionPayload): Promise<SessionCheck> {
  const [user, settings] = await Promise.all([
    prisma.user.findUnique({
      where: { id: payload.userId },
      select: { role: true, name: true, email: true, accountStatus: true, sessionVersion: true },
    }),
    prisma.appSettings.findUnique({ where: { id: 'singleton' }, select: { maintenanceMode: true } }),
  ])

  // Deleted user, or the password changed since this cookie was issued
  if (!user || user.sessionVersion !== (payload.sessionVersion ?? 0)) return { ended: 'session_ended' }

  if (user.accountStatus === 'PENDING') return { ended: 'pending' }
  if (user.accountStatus === 'REJECTED') return { ended: 'rejected' }
  if (user.accountStatus !== 'APPROVED' && user.accountStatus !== 'INVITED') return { ended: 'suspended' }
  if (settings?.maintenanceMode && user.role !== 'ADMIN') return { ended: 'maintenance' }

  return {
    session: {
      ...payload,
      role: user.role as Role,
      name: user.name,
      email: user.email,
      mustChangePassword: user.accountStatus === 'INVITED',
    },
  }
}
