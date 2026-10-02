import { NextRequest, NextResponse } from 'next/server'
import { AiNotConfiguredError, summarizeTicket } from '@/lib/gemini'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/session'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.role !== 'IT_SUPPORT' && session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const locale = req.nextUrl.searchParams.get('locale') === 'ar' ? 'ar' : 'en'

  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: {
      createdBy: { select: { name: true } },
      assignedTo: { select: { name: true } },
      comments: {
        include: { author: { select: { name: true, role: true } } },
        orderBy: { createdAt: 'asc' },
      },
    },
  })
  if (!ticket) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  try {
    const result = await summarizeTicket(
      {
        title: ticket.title,
        description: ticket.description,
        status: ticket.status,
        priority: ticket.priority,
        category: ticket.category,
        createdBy: ticket.createdBy.name,
        assignedTo: ticket.assignedTo?.name,
      },
      ticket.comments.map((c) => ({
        author: c.author.name,
        role: c.author.role,
        content: c.content,
        isInternal: c.isInternal,
        createdAt: c.createdAt.toISOString(),
      })),
      locale,
    )
    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof AiNotConfiguredError) {
      return NextResponse.json({ error: 'AI is not configured' }, { status: 503 })
    }
    console.error('[AI summary] Gemini request failed:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'AI summary is unavailable right now' }, { status: 502 })
  }
}
