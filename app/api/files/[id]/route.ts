import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/session'
import { getStorage } from '@/lib/storage'

/** Types a browser can show safely; everything else is downloaded */
const INLINE = /^(image\/(png|jpeg|gif|webp)|application\/pdf|text\/plain)$/

/**
 * Serves an attachment to someone allowed to see it: whoever uploaded it, or
 * anyone who can see its ticket (the requester, IT support, admins).
 * Unknown and forbidden files get the same 404, so ids can't be probed.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { id } = await params
  const file = await prisma.attachment.findUnique({
    where: { id },
    include: { ticket: { select: { createdById: true } } },
  })

  const allowed =
    file &&
    (file.uploadedById === session.userId ||
      (file.ticket && (session.role !== 'EMPLOYEE' || file.ticket.createdById === session.userId)))
  if (!file || !allowed) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const body = await getStorage().get(file.storageKey)
  if (!body) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const disposition = INLINE.test(file.type) ? 'inline' : 'attachment'
  const headers: Record<string, string> = {
    'Content-Type': file.type,
    'Content-Length': String(file.size),
    'Content-Disposition': `${disposition}; filename*=UTF-8''${encodeURIComponent(file.name)}`,
    'X-Content-Type-Options': 'nosniff',
    // Per user: never stored by shared caches
    'Cache-Control': 'private, max-age=3600',
  }
  // Even if a file were rendered as a page, it could not run scripts. (Not for PDFs:
  // browsers refuse to open their PDF viewer in a sandboxed document.)
  if (file.type !== 'application/pdf') {
    headers['Content-Security-Policy'] = "sandbox; default-src 'none'; img-src 'self'; style-src 'unsafe-inline'"
  }
  return new Response(body, { headers })
}
