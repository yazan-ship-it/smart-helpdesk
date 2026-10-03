import { NextResponse } from 'next/server'
import { checkDatabase } from '@/lib/health'

/** Liveness check for container hosts and uptime monitors. Public, and says nothing else. */
export async function GET() {
  const db = await checkDatabase()
  return NextResponse.json(
    { status: db.ok ? 'ok' : 'degraded', database: db.ok ? 'up' : 'down' },
    { status: db.ok ? 200 : 503, headers: { 'Cache-Control': 'no-store' } },
  )
}
