import { en } from './locales/en'
import { ar } from './locales/ar'

export * from './LanguageContext'
export * from './locales/en'
export * from './locales/ar'

export function getStatusLabel(status: string, locale: 'en' | 'ar' = 'en'): string {
  const dict = locale === 'ar' ? ar.statuses : en.statuses
  const upper = (status || '').toUpperCase()
  return (dict as Record<string, string>)[upper] || (dict as Record<string, string>)[status] || status
}

export function getPriorityLabel(priority: string, locale: 'en' | 'ar' = 'en'): string {
  const dict = locale === 'ar' ? ar.priorities : en.priorities
  const upper = (priority || '').toUpperCase()
  return (dict as Record<string, string>)[upper] || (dict as Record<string, string>)[priority] || priority
}

export function getCategoryLabel(category: string, locale: 'en' | 'ar' = 'en'): string {
  const dict = locale === 'ar' ? ar.categories : en.categories
  if (!category) return category
  if ((dict as Record<string, string>)[category]) {
    return (dict as Record<string, string>)[category]
  }
  const lower = category.toLowerCase()
  if (locale === 'ar') {
    if (lower.includes('hardware')) return 'أجهزة ومعدات'
    if (lower.includes('software')) return 'برمجيات وأنظمة'
    if (lower.includes('network') || lower.includes('vpn') || lower.includes('wifi')) return 'شبكات وإنترنت'
    if (lower.includes('email') || lower.includes('communication')) return 'البريد والتواصل'
    if (lower.includes('access') || lower.includes('permission')) return 'الصلاحيات والوصول'
    if (lower.includes('printer')) return 'الطابعات'
    if (lower.includes('security')) return 'الأمن السيبراني'
    if (lower.includes('other')) return 'أخرى'
  }
  return category
}
