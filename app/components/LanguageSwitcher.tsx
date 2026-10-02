'use client'

import React from 'react'
import { Globe } from 'lucide-react'
import { useTranslation } from '@/lib/i18n'

export default function LanguageSwitcher({ className = '' }: { className?: string }) {
  const { t, locale, toggleLanguage } = useTranslation()

  return (
    <button
      type="button"
      onClick={toggleLanguage}
      title={locale === 'en' ? 'التبديل إلى العربية (RTL)' : 'Switch to English (LTR)'}
      aria-label={t('ui.toggleLanguage')}
      className={`group relative inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-xl border border-border/80 bg-background/80 hover:bg-muted/70 hover:border-primary/40 active:scale-95 transition-all text-foreground cursor-pointer shadow-xs ${className}`}
    >
      <Globe className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400 shrink-0 transition-transform duration-300 group-hover:rotate-45" />
      <span className="font-semibold tracking-wide select-none">
        {locale === 'en' ? 'العربية' : 'English'}
      </span>
    </button>
  )
}
