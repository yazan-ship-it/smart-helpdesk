import { prisma } from '@/lib/db'

export const DEFAULT_CATEGORIES = [
  'Hardware',
  'Software',
  'Network',
  'Email & Communication',
  'Access & Permissions',
  'Printer',
  'Security',
  'Other',
]

export async function getAppSettings() {
  return prisma.appSettings.findUnique({ where: { id: 'singleton' } })
}

/** The admin-managed ticket categories, falling back to the defaults. */
export function parseCategories(categoriesList: string | null | undefined): string[] {
  try {
    const parsed: unknown = categoriesList ? JSON.parse(categoriesList) : null
    if (Array.isArray(parsed)) {
      const list = parsed.filter((c): c is string => typeof c === 'string' && c.trim().length > 0)
      if (list.length > 0) return list
    }
  } catch {
    // Corrupt value: use the defaults below
  }
  return DEFAULT_CATEGORIES
}
