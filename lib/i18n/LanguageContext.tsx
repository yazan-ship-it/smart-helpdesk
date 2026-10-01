'use client'

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react'
import { en, type TranslationDictionary } from './locales/en'
import { ar } from './locales/ar'

export type Locale = 'en' | 'ar'
export type Direction = 'ltr' | 'rtl'

interface LanguageContextType {
  locale: Locale
  dir: Direction
  isRTL: boolean
  setLocale: (locale: Locale) => void
  toggleLanguage: () => void
  t: (path: string, paramsOrFallback?: Record<string, string | number> | string) => string
  dictionary: TranslationDictionary
}

const dictionaries: Record<Locale, TranslationDictionary> = { en, ar }

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

const STORAGE_KEY = 'helpdesk-lang'

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(STORAGE_KEY) as Locale | null;
        if (stored === 'en' || stored === 'ar') return stored;
        const browserLang = navigator.language?.toLowerCase();
        if (browserLang?.startsWith('ar')) return 'ar';
      } catch {
        // Fallback silently if localStorage is restricted
      }
    }
    return 'en';
  });

  const dir: Direction = locale === 'ar' ? 'rtl' : 'ltr'
  const isRTL = dir === 'rtl'

  // Apply HTML attributes whenever locale changes
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.dir = dir
      document.documentElement.lang = locale
      document.documentElement.setAttribute('data-lang', locale)
      
      // Update cookie for SSR/hybrid compatibility
      document.cookie = `${STORAGE_KEY}=${locale}; path=/; max-age=31536000; SameSite=Lax`
    }
  }, [locale, dir])

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale)
    try {
      localStorage.setItem(STORAGE_KEY, newLocale)
    } catch {
      // Ignore storage errors
    }
  }, [])

  const toggleLanguage = useCallback(() => {
    setLocaleState((prev) => {
      const next: Locale = prev === 'en' ? 'ar' : 'en'
      try {
        localStorage.setItem(STORAGE_KEY, next)
      } catch {
        // Ignore storage errors
      }
      return next
    })
  }, [])

  const dictionary = useMemo(() => dictionaries[locale], [locale])

  // Translation lookup helper with dot-notation and parameter interpolation
  const t = useCallback(
    (path: string, paramsOrFallback?: Record<string, string | number> | string): string => {
      const fallbackText = typeof paramsOrFallback === 'string' ? paramsOrFallback : undefined
      const params = typeof paramsOrFallback === 'object' ? paramsOrFallback : undefined

      const keys = path.split('.')
      
      // Helper to traverse object
      const resolveKey = (dict: unknown): unknown => {
        let current: any = dict
        for (const k of keys) {
          if (current && typeof current === 'object' && k in current) {
            current = current[k]
          } else {
            return undefined
          }
        }
        return current
      }

      let result = resolveKey(dictionary)
      if (result === undefined && locale !== 'en') {
        result = resolveKey(en) // fallback to English
      }

      if (typeof result !== 'string') {
        return fallbackText || path
      }

      let text = result
      // Parameter replacement like {count} or {name}
      if (params) {
        Object.entries(params).forEach(([paramKey, val]) => {
          text = text.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(val))
        })
      }

      return text
    },
    [dictionary, locale]
  )

  const value = useMemo(
    () => ({
      locale,
      dir,
      isRTL,
      setLocale,
      toggleLanguage,
      t,
      dictionary,
    }),
    [locale, dir, isRTL, setLocale, toggleLanguage, t, dictionary]
  )

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useTranslation() {
  const context = useContext(LanguageContext)
  if (!context) {
    throw new Error('useTranslation must be used within a LanguageProvider')
  }
  return context
}
