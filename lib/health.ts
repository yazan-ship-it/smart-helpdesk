import { prisma } from '@/lib/db'

/** Run a trivial query and time it, for the admin status panel. */
export async function checkDatabase(): Promise<{ ok: boolean; latencyMs: number }> {
  const start = performance.now()
  const ok = await prisma.$queryRaw`SELECT 1`.then(
    () => true,
    () => false,
  )
  return { ok, latencyMs: Math.max(1, Math.round(performance.now() - start)) }
}
