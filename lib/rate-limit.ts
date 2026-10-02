import 'server-only'
import { headers } from 'next/headers'
import { prisma } from '@/lib/db'

export type RateLimitRule = { limit: number; windowMs: number }

const MINUTE = 60 * 1000

/** Failed sign-ins per account, and per client address (catches one address trying many accounts) */
export const LOGIN_PER_ACCOUNT: RateLimitRule = { limit: 5, windowMs: 15 * MINUTE }
export const LOGIN_PER_ADDRESS: RateLimitRule = { limit: 20, windowMs: 15 * MINUTE }
/** Account requests per client address */
export const REGISTER_PER_ADDRESS: RateLimitRule = { limit: 5, windowMs: 60 * MINUTE }

/*
 * Fixed-window counters stored in the database, so limits survive restarts and
 * are shared by every server instance.
 */

/** Milliseconds until another attempt is allowed, or 0 if it is allowed now */
export async function retryAfter(key: string, rule: RateLimitRule): Promise<number> {
  const row = await prisma.rateLimit.findUnique({ where: { key } })
  if (!row || row.count < rule.limit) return 0
  return Math.max(0, row.windowStart.getTime() + rule.windowMs - Date.now())
}

export async function recordAttempt(key: string, rule: RateLimitRule): Promise<void> {
  const now = new Date()
  const windowOpenedAfter = new Date(now.getTime() - rule.windowMs)
  await prisma.$transaction(async (tx) => {
    const row = await tx.rateLimit.findUnique({ where: { key } })
    if (row && row.windowStart > windowOpenedAfter) {
      await tx.rateLimit.update({ where: { key }, data: { count: { increment: 1 } } })
    } else {
      await tx.rateLimit.upsert({
        where: { key },
        create: { key, count: 1, windowStart: now },
        update: { count: 1, windowStart: now },
      })
    }
  })
  // Housekeeping: drop counters whose window ended long ago
  await prisma.rateLimit.deleteMany({ where: { windowStart: { lt: new Date(now.getTime() - 24 * 60 * MINUTE) } } })
}

export async function clearAttempts(key: string): Promise<void> {
  await prisma.rateLimit.deleteMany({ where: { key } })
}

/**
 * The client address. Behind a reverse proxy (any real deployment), the proxy
 * must set X-Forwarded-For; otherwise all clients share one counter.
 */
export async function clientAddress(): Promise<string> {
  const h = await headers()
  return h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || 'unknown'
}
