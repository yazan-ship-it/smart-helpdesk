import { NextRequest, NextResponse } from 'next/server'
import { isAiConfigured, triageTicket } from '@/lib/gemini'
import { ruleBasedTriage, type Locale, type TriageSuggestion } from '@/lib/ai/triage'
import { getSession } from '@/lib/session'
import { getAppSettings, parseCategories } from '@/lib/settings'

// Cap what we send to the model to keep latency and cost predictable
const MAX_TITLE = 200
const MAX_DESCRIPTION = 4000

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const settings = await getAppSettings()
  if (settings && !settings.enableAiTriage) {
    return NextResponse.json({ error: 'AI triage is disabled' }, { status: 403 })
  }

  let body: { title?: unknown; description?: unknown; locale?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const title = typeof body.title === 'string' ? body.title.trim().slice(0, MAX_TITLE) : ''
  const description = typeof body.description === 'string' ? body.description.trim().slice(0, MAX_DESCRIPTION) : ''
  if (!title && !description) {
    return NextResponse.json({ error: 'Title or description required' }, { status: 400 })
  }

  const locale: Locale = body.locale === 'ar' ? 'ar' : 'en'
  const categories = parseCategories(settings?.categoriesList)

  if (isAiConfigured()) {
    try {
      const result: TriageSuggestion = { source: 'ai', ...(await triageTicket(title, description, categories, locale)) }
      return NextResponse.json(result)
    } catch (err) {
      console.error('[AI triage] Gemini request failed:', err instanceof Error ? err.message : err)
    }
  }

  if (settings?.fallbackHeuristicsEnabled ?? true) {
    return NextResponse.json(ruleBasedTriage(title, description, categories, locale))
  }
  return NextResponse.json({ error: 'AI triage is unavailable' }, { status: 503 })
}
