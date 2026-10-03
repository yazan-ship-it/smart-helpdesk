import { en } from './locales/en'
import { ar } from './locales/ar'

export type TranslateParams = Record<string, string | number>
export type Translate = (path: string, paramsOrFallback?: TranslateParams | string) => string

const dictionaries = { en, ar }

function resolve(dict: unknown, keys: string[]): unknown {
  let current = dict
  for (const k of keys) {
    if (current && typeof current === 'object' && k in current) {
      current = (current as Record<string, unknown>)[k]
    } else {
      return undefined
    }
  }
  return current
}

/**
 * Look up a dot-separated key (e.g. "tickets.title") in the locale's dictionary,
 * falling back to English, and fill in {placeholders}. Works on the server and
 * the client; components use it through useTranslation().
 */
export function createTranslator(locale: 'en' | 'ar'): Translate {
  return (path, paramsOrFallback) => {
    const fallbackText = typeof paramsOrFallback === 'string' ? paramsOrFallback : undefined
    const params = typeof paramsOrFallback === 'object' ? paramsOrFallback : undefined
    const keys = path.split('.')

    let result = resolve(dictionaries[locale], keys)
    if (result === undefined && locale !== 'en') result = resolve(en, keys)
    if (typeof result !== 'string') return fallbackText || path

    let text = result
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        text = text.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value))
      }
    }
    return text
  }
}
