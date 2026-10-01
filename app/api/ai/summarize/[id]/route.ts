import { NextRequest, NextResponse } from 'next/server'
import { summarizeTicket } from '@/lib/gemini'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/session'
import { cookies } from 'next/headers'

export async function POST(
 req: NextRequest,
 { params }: { params: Promise<{ id: string }> }
) {
 try {
 // Auth check
 const cookieStore = await cookies()
 const cookie = cookieStore.get('helpdesk-session')?.value
 if (!cookie) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

 const { decrypt } = await import('@/lib/session')
 const session = await decrypt(cookie)
 if (!session || session.role !== 'IT_SUPPORT') {
 return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
 }

 const { id } = await params
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
 createdAt: c.createdAt.toISOString(),
 }))
 )

 return NextResponse.json(result)
 } catch (err) {
 const message = err instanceof Error ? err.message : 'AI summary failed'
 const isConfig = message.includes('not configured')
 return NextResponse.json({ error: message }, { status: isConfig ? 503 : 500 })
 }
}
