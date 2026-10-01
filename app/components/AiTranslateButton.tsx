'use client'

import React, { useState } from 'react'
import { Sparkles, Loader2, EyeOff, RotateCcw } from 'lucide-react'
import { translateAction } from '@/app/actions/translate'
import { useTranslation } from '@/lib/i18n'

type Props = {
  text: string
  className?: string
  defaultTargetLanguage?: 'Arabic' | 'English'
}

export default function AiTranslateButton({
  text,
  className = '',
  defaultTargetLanguage,
}: Props) {
  const { locale } = useTranslation()
  const [isLoading, setIsLoading] = useState(false)
  const [translation, setTranslation] = useState<string | null>(null)
  const [isVisible, setIsVisible] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!text || !text.trim()) {
    return null
  }

  // Detect language: if contains Arabic, translate to English; otherwise translate to Arabic
  const hasArabic = /[\u0600-\u06FF]/.test(text)
  const targetLanguage: 'Arabic' | 'English' = defaultTargetLanguage
    ? defaultTargetLanguage
    : hasArabic
      ? 'English'
      : 'Arabic'

  const handleTranslate = async () => {
    if (translation) {
      setIsVisible(true)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const res = await translateAction({ text, targetLanguage })
      if (res.success && res.translation) {
        setTranslation(res.translation)
        setIsVisible(true)
      } else {
        setError(res.error || (locale === 'ar' ? 'فشلت الترجمة، يرجى المحاولة لاحقاً' : 'Translation failed'))
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Translation error')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className={`mt-2 ${className}`}>
      {/* Trigger button when translation is not visible */}
      {!isVisible && (
        <button
          type="button"
          onClick={handleTranslate}
          disabled={isLoading}
          className="group inline-flex items-center gap-1.5 py-1 px-2 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all cursor-pointer disabled:opacity-50 select-none border border-transparent hover:border-border/60"
          title={locale === 'ar' ? 'ترجمة فورية بواسطة الذكاء الاصطناعي (Gemini)' : 'Instant translation with Gemini AI'}
        >
          {isLoading ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin text-primary shrink-0" />
              <span className="font-medium text-foreground">
                {locale === 'ar' ? 'جاري الترجمة...' : 'Translating...'}
              </span>
            </>
          ) : translation ? (
            <>
              <Sparkles className="w-3.5 h-3.5 text-indigo-500 shrink-0 transition-transform group-hover:scale-110" />
              <span>
                {locale === 'ar' ? '✨ إظهار الترجمة' : '✨ Show Translation'}
              </span>
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5 text-indigo-500 shrink-0 transition-transform group-hover:scale-110" />
              <span>
                {locale === 'ar'
                  ? '✨ ترجمة بواسطة الذكاء الاصطناعي'
                  : '✨ Translate with AI'}
              </span>
            </>
          )}
        </button>
      )}

      {/* Loading Skeleton Callout */}
      {isLoading && !translation && (
        <div className="mt-2 p-3 rounded-xl bg-primary/5 dark:bg-primary/10 border border-primary/20 text-foreground text-sm flex items-center gap-2.5 animate-pulse">
          <Loader2 className="w-4 h-4 animate-spin text-primary shrink-0" />
          <span className="text-xs text-muted-foreground font-medium">
            {locale === 'ar'
              ? 'جاري الترجمة التقنية عبر Gemini الذكي...'
              : 'Translating IT content with Gemini AI...'}
          </span>
        </div>
      )}

      {/* Error Callout with Retry */}
      {error && !translation && (
        <div className="mt-2 p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs flex items-center justify-between gap-2">
          <span>{error}</span>
          <button
            type="button"
            onClick={handleTranslate}
            className="inline-flex items-center gap-1 font-semibold hover:underline cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            <span>{locale === 'ar' ? 'إعادة المحاولة' : 'Retry'}</span>
          </button>
        </div>
      )}

      {/* Translated Callout Box */}
      {isVisible && translation && (
        <div className="mt-2.5 p-3.5 rounded-xl bg-primary/5 dark:bg-primary/10 border border-primary/20 text-foreground text-sm shadow-xs transition-all space-y-2">
          <div className="flex items-center justify-between border-b border-primary/15 pb-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
              <Sparkles className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
              <span>
                {locale === 'ar'
                  ? '✨ مترجم بواسطة الذكاء الاصطناعي (Gemini)'
                  : '✨ Translated with AI (Gemini)'}
              </span>
              <span className="text-[10px] px-1.5 py-0.2 rounded font-mono font-medium bg-primary/10 text-primary border border-primary/20">
                {targetLanguage === 'Arabic' ? 'العربية' : 'English'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsVisible(false)}
              className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground font-medium transition-colors cursor-pointer px-1.5 py-0.5 rounded hover:bg-muted/40"
              title={locale === 'ar' ? 'إخفاء صندوق الترجمة' : 'Hide translation box'}
            >
              <EyeOff className="w-3 h-3" />
              <span>{locale === 'ar' ? 'إخفاء الترجمة' : 'Hide Translation'}</span>
            </button>
          </div>

          <div
            className="text-sm leading-relaxed text-foreground whitespace-pre-wrap select-text font-sans"
            dir={targetLanguage === 'Arabic' ? 'rtl' : 'ltr'}
          >
            {translation}
          </div>
        </div>
      )}
    </div>
  )
}
