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
/** Files uploaded per user, so one account can't fill the storage */
export const UPLOAD_PER_USER: RateLimitRule = { limit: 30, windowMs: 60 * MINUTE }
/** Gemini requests per user (triage, summaries, translation), so one user can't use up the quota */
export const AI_PER_USER: RateLimitRule = { limit: 30, windowMs: 10 * MINUTE }

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
  // One atomic statement, so simultaneous attempts are all counted and never collide:
  // a new counter, +1 inside the current window, or a fresh window once it has passed
  await prisma.$executeRaw`
    INSERT INTO "RateLimit" ("key", "count", "windowStart") VALUES (${key}, 1, ${now})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateLimit"."windowStart" > ${windowOpenedAfter} THEN "RateLimit"."count" + 1 ELSE 1 END,
      "windowStart" = CASE WHEN "RateLimit"."windowStart" > ${windowOpenedAfter} THEN "RateLimit"."windowStart" ELSE ${now} END
  `
  // Housekeeping: drop counters whose window ended long ago
  await prisma.rateLimit.deleteMany({ where: { windowStart: { lt: new Date(now.getTime() - 24 * 60 * MINUTE) } } })
}

/** Counts one AI request for the user; false if they are over their limit */
export async function allowAiRequest(userId: string): Promise<boolean> {
  const key = `ai:user:${userId}`
  if ((await retryAfter(key, AI_PER_USER)) > 0) return false
  await recordAttempt(key, AI_PER_USER)
  return true
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
