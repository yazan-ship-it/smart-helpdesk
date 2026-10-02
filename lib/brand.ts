import { en } from '@/lib/i18n/locales/en'
import { ar } from '@/lib/i18n/locales/ar'

const DEFAULT_APP_NAME = 'Smart Helpdesk'

/**
 * The product name to display. The default name is translated; a custom
 * name set by the admin in Settings is shown as typed, in every language.
 */
export function getBrandName(appName: string | null | undefined, locale: 'en' | 'ar'): string {
  const custom = appName?.trim()
  if (custom && custom !== DEFAULT_APP_NAME) return custom
  return locale === 'ar' ? ar.brand.name : en.brand.name
}
