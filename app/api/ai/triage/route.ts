import { NextRequest, NextResponse } from 'next/server'
import { triageTicket } from '@/lib/gemini'
import { getSession } from '@/lib/session'

export async function POST(req: NextRequest) {
 const session = await getSession()
 if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

 try {
 const { title, description } = await req.json()

 if (!title?.trim() && !description?.trim()) {
 return NextResponse.json({ error: 'Title and description required' }, { status: 400 })
 }

 const result = await triageTicket(title ?? '', description ?? '')
 return NextResponse.json(result)
 } catch (err) {
 const message = err instanceof Error ? err.message : 'AI analysis failed'
 const isConfig = message.includes('not configured')
 return NextResponse.json(
 { error: message },
 { status: isConfig ? 503 : 500 }
 )
 }
}
