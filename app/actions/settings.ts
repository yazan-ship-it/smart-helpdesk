'use server'

import { prisma } from '@/lib/db'
import { getSession } from '@/lib/session'
import { revalidatePath } from 'next/cache'
import { getAppSettings, parseCategories } from '@/lib/settings'
import { sanitizeSkills } from '@/lib/skills'
import { PRIORITIES, type Priority } from '@/lib/ai/triage'
import { fail, type ActionResult, type ErrorCode } from '@/lib/errors'

export type SettingsInput = {
  appName: string
  supportEmail: string
  defaultPriority: string
  autoAssignmentEnabled: boolean
  slaCriticalHours: number
  slaHighHours: number
  slaMediumHours: number
  slaLowHours: number
  businessHoursStart: string
  businessHoursEnd: string
  workDays: string
  pauseSlaOnWeekends: boolean
  enableAiTriage: boolean
  fallbackHeuristicsEnabled: boolean
  autoApproveDomain: string
  maintenanceMode: boolean
  categoriesList: string
  cannedResponses: string
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function isStringArray(json: string, allowed?: string[]): boolean {
  try {
    const value: unknown = JSON.parse(json)
    return (
      Array.isArray(value) &&
      value.length > 0 &&
      value.every((v) => typeof v === 'string' && v.trim().length > 0 && (!allowed || allowed.includes(v)))
    )
  } catch {
    return false
  }
}

/** Server-side check of everything the settings form sends; returns an error code or null. */
function validateSettings(data: SettingsInput): ErrorCode | null {
  const appName = typeof data.appName === 'string' ? data.appName.trim() : ''
  if (!appName || appName.length > 60) return 'settings_app_name'
  if (!EMAIL.test(data.supportEmail ?? '')) return 'settings_support_email'
  if (!PRIORITIES.includes(data.defaultPriority as Priority)) return 'settings_default_priority'
  const hours = [data.slaCriticalHours, data.slaHighHours, data.slaMediumHours, data.slaLowHours]
  if (!hours.every((h) => Number.isInteger(h) && h >= 1 && h <= 720)) return 'settings_sla_hours'
  if (!TIME.test(data.businessHoursStart) || !TIME.test(data.businessHoursEnd)) return 'settings_time_format'
  if (data.businessHoursStart >= data.businessHoursEnd) return 'settings_hours_order'
  if (!isStringArray(data.workDays, DAYS)) return 'settings_work_days'
  if (!isStringArray(data.categoriesList)) return 'settings_categories'
  if (!/^@[a-z0-9.-]+\.[a-z]{2,}$/i.test((data.autoApproveDomain ?? '').trim())) return 'settings_domain'
  try {
    if (!Array.isArray(JSON.parse(data.cannedResponses))) return 'settings_canned'
  } catch {
    return 'settings_canned'
  }
  return null
}

export async function updateSettings(data: SettingsInput): Promise<ActionResult> {
  const session = await getSession()
  if (!session || session.role !== 'ADMIN') return fail('unauthorized')

  const error = validateSettings(data)
  if (error) return fail(error)

  const fields = {
    appName: data.appName.trim(),
    supportEmail: data.supportEmail.trim(),
    defaultPriority: data.defaultPriority,
    autoAssignmentEnabled: Boolean(data.autoAssignmentEnabled),
    slaCriticalHours: data.slaCriticalHours,
    slaHighHours: data.slaHighHours,
    slaMediumHours: data.slaMediumHours,
    slaLowHours: data.slaLowHours,
    businessHoursStart: data.businessHoursStart,
    businessHoursEnd: data.businessHoursEnd,
    workDays: data.workDays,
    pauseSlaOnWeekends: Boolean(data.pauseSlaOnWeekends),
    enableAiTriage: Boolean(data.enableAiTriage),
    fallbackHeuristicsEnabled: Boolean(data.fallbackHeuristicsEnabled),
    autoApproveDomain: data.autoApproveDomain.trim().toLowerCase(),
    maintenanceMode: Boolean(data.maintenanceMode),
    categoriesList: data.categoriesList,
    cannedResponses: data.cannedResponses,
  }

  await prisma.appSettings.upsert({
    where: { id: 'singleton' },
    update: fields,
    create: { id: 'singleton', ...fields },
  })

  // Settings affect every page (app name, maintenance banner, forms)
  revalidatePath('/', 'layout')
  return {}
}

export async function updateAgentSkills(userId: string, skills: string[]): Promise<ActionResult & { success: boolean }> {
  const session = await getSession()
  if (!session || session.role !== 'ADMIN') return { success: false, error: 'unauthorized' }

  const agent = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } })
  if (agent?.role !== 'IT_SUPPORT') return { success: false, error: 'invalid_role' }

  const categories = parseCategories((await getAppSettings())?.categoriesList)
  await prisma.user.update({
    where: { id: userId },
    data: { skills: JSON.stringify(sanitizeSkills(skills, categories)) },
  })

  revalidatePath('/admin/settings')
  return { success: true }
}
