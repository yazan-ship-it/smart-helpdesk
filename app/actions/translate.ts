'use server'

import { AiNotConfiguredError, translateText } from '@/lib/gemini'
import { getSession } from '@/lib/session'
import { allowAiRequest } from '@/lib/rate-limit'

const MAX_LENGTH = 5000

export type TranslateResult =
  | { success: true; translation: string }
  | { success: false; error: 'unauthorized' | 'empty' | 'too_long' | 'rate_limited' | 'not_configured' | 'failed' }

export async function translateAction({
  text,
  targetLanguage,
}: {
  text: string
  targetLanguage: 'Arabic' | 'English'
}): Promise<TranslateResult> {
  const session = await getSession()
  if (!session) return { success: false, error: 'unauthorized' }

  if (!text?.trim()) return { success: false, error: 'empty' }
  if (text.length > MAX_LENGTH) return { success: false, error: 'too_long' }
  if (!(await allowAiRequest(session.userId))) return { success: false, error: 'rate_limited' }

  try {
    const translation = await translateText(text, targetLanguage === 'Arabic' ? 'Arabic' : 'English')
    return { success: true, translation }
  } catch (err) {
    if (err instanceof AiNotConfiguredError) return { success: false, error: 'not_configured' }
    console.error('[AI translate] Gemini request failed:', err instanceof Error ? err.message : err)
    return { success: false, error: 'failed' }
  }
}
