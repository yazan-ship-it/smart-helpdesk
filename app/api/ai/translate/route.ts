import { NextRequest, NextResponse } from 'next/server'
import { translateText } from '@/lib/gemini'
import { getSession } from '@/lib/session'

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { text, targetLanguage } = await req.json()

    if (!text || !text.trim()) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 })
    }

    const lang = targetLanguage === 'Arabic' ? 'Arabic' : 'English'
    const translation = await translateText(text, lang)

    return NextResponse.json({ success: true, translation })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Translation failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
