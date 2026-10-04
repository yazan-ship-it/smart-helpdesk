import { cache } from 'react'
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

/** The settings row, read once per request however many components ask for it */
export const getAppSettings = cache(async () => prisma.appSettings.findUnique({ where: { id: 'singleton' } }))

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

export type CannedResponse = { id: string; title: string; content: string }

/** The admin's canned replies (Settings); anything malformed is skipped. */
export function parseCannedResponses(json: string | null | undefined): CannedResponse[] {
  try {
    const parsed: unknown = json ? JSON.parse(json) : []
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (r): r is CannedResponse =>
        typeof r === 'object' && r !== null && typeof r.id === 'string' && typeof r.title === 'string' && typeof r.content === 'string',
    )
  } catch {
    return []
  }
}
