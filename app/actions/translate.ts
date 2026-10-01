'use server'

import { translateText as translateGemini } from '@/lib/gemini'
import { getSession } from '@/lib/session'

export type TranslateResult = {
  success: boolean
  translation?: string
  error?: string
}

export async function translateAction({
  text,
  targetLanguage,
}: {
  text: string
  targetLanguage: 'Arabic' | 'English'
}): Promise<TranslateResult> {
  const session = await getSession()
  if (!session) return { success: false, error: 'Unauthorized' }

  if (!text || !text.trim()) {
    return { success: false, error: 'Text to translate cannot be empty' }
  }

  try {
    const translation = await translateGemini(text, targetLanguage)
    return { success: true, translation }
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Translation failed',
    }
  }
}
