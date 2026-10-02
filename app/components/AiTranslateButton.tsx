'use client'

import { useState } from 'react'
import { Languages, Loader2, EyeOff, RotateCcw } from 'lucide-react'
import { translateAction } from '@/app/actions/translate'
import { useTranslation } from '@/lib/i18n'

const ARABIC_SCRIPT = /[؀-ۿ]/

export default function AiTranslateButton({ text, className = '' }: { text: string; className?: string }) {
  const { t, locale } = useTranslation()
  const [isLoading, setIsLoading] = useState(false)
  const [translation, setTranslation] = useState<string | null>(null)
  const [isVisible, setIsVisible] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!text?.trim()) return null

  // Translate into the viewer's language, unless the text is already written in it
  const textIsArabic = ARABIC_SCRIPT.test(text)
  const targetLanguage: 'Arabic' | 'English' =
    locale === 'ar' ? (textIsArabic ? 'English' : 'Arabic') : textIsArabic ? 'English' : 'Arabic'

  const handleTranslate = async () => {
    if (translation) {
      setIsVisible(true)
      return
    }
    setIsLoading(true)
    setError(null)
    try {
      const res = await translateAction({ text, targetLanguage })
      if (res.success) {
        setTranslation(res.translation)
        setIsVisible(true)
      } else {
        setError(t(`ai.errors.${res.error}`, t('ai.errors.failed')))
      }
    } catch {
      setError(t('ai.errors.failed'))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className={`mt-2 ${className}`}>
      {!isVisible && (
        <button
          type="button"
          onClick={handleTranslate}
          disabled={isLoading}
          className="inline-flex items-center gap-1.5 py-1 px-2 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors cursor-pointer disabled:opacity-50 select-none"
        >
          {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" /> : <Languages className="w-3.5 h-3.5 shrink-0" />}
          <span>{isLoading ? t('ai.translating') : translation ? t('ai.showTranslation') : t('ai.translate')}</span>
        </button>
      )}

      {error && !translation && (
        <div className="mt-2 p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs flex items-center justify-between gap-2">
          <span>{error}</span>
          <button type="button" onClick={handleTranslate} className="inline-flex items-center gap-1 font-semibold hover:underline cursor-pointer">
            <RotateCcw className="w-3 h-3" />
            <span>{t('ai.retry')}</span>
          </button>
        </div>
      )}

      {isVisible && translation && (
        <div className="mt-2.5 p-3.5 rounded-xl bg-primary/5 dark:bg-primary/10 border border-primary/20 text-sm space-y-2">
          <div className="flex items-center justify-between border-b border-primary/15 pb-2">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-primary">
              <Languages className="w-3.5 h-3.5 shrink-0" />
              {t('ai.machineTranslation')}
            </span>
            <button
              type="button"
              onClick={() => setIsVisible(false)}
              className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground cursor-pointer px-1.5 py-0.5 rounded hover:bg-muted/40"
            >
              <EyeOff className="w-3 h-3" />
              <span>{t('ai.hideTranslation')}</span>
            </button>
          </div>
          <div
            className="leading-relaxed text-foreground whitespace-pre-wrap"
            dir={targetLanguage === 'Arabic' ? 'rtl' : 'ltr'}
            lang={targetLanguage === 'Arabic' ? 'ar' : 'en'}
          >
            {translation}
          </div>
        </div>
      )}
    </div>
  )
}
