'use server'

import { prisma } from '@/lib/db'
import { getSession } from '@/lib/session'
import { revalidatePath } from 'next/cache'
import { getAppSettings, parseCategories } from '@/lib/settings'
import { sanitizeSkills } from '@/lib/skills'
import { PRIORITIES, type Priority } from '@/lib/ai/triage'

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

/** Server-side check of everything the settings form sends; returns an error message or null. */
function validateSettings(data: SettingsInput): string | null {
  if (!data.appName?.trim()) return 'App name is required.'
  if (!EMAIL.test(data.supportEmail ?? '')) return 'A valid support email is required.'
  if (!PRIORITIES.includes(data.defaultPriority as Priority)) return 'Invalid default priority.'
  const hours = [data.slaCriticalHours, data.slaHighHours, data.slaMediumHours, data.slaLowHours]
  if (!hours.every((h) => Number.isInteger(h) && h >= 1 && h <= 720)) return 'SLA hours must be whole numbers between 1 and 720.'
  if (!TIME.test(data.businessHoursStart) || !TIME.test(data.businessHoursEnd)) return 'Business hours must use the HH:MM format.'
  if (data.businessHoursStart >= data.businessHoursEnd) return 'Business hours must end after they start.'
  if (!isStringArray(data.workDays, DAYS)) return 'Select at least one valid working day.'
  if (!isStringArray(data.categoriesList)) return 'Define at least one category.'
  if (!data.autoApproveDomain?.startsWith('@')) return 'The auto-approve domain must start with "@".'
  try {
    if (!Array.isArray(JSON.parse(data.cannedResponses))) return 'Invalid canned responses.'
  } catch {
    return 'Invalid canned responses.'
  }
  return null
}

export async function updateSettings(data: SettingsInput): Promise<{ error?: string }> {
  const session = await getSession()
  if (!session || session.role !== 'ADMIN') return { error: 'Unauthorized' }

  const error = validateSettings(data)
  if (error) return { error }

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

export async function updateAgentSkills(userId: string, skills: string[]) {
  const session = await getSession()
  if (!session || session.role !== 'ADMIN') {
    throw new Error('Unauthorized')
  }

  const agent = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } })
  if (agent?.role !== 'IT_SUPPORT') return { success: false }

  const categories = parseCategories((await getAppSettings())?.categoriesList)
  await prisma.user.update({
    where: { id: userId },
    data: { skills: JSON.stringify(sanitizeSkills(skills, categories)) },
  })

  revalidatePath('/admin/settings')
  return { success: true }
}
