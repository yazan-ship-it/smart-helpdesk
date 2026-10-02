'use server'

import { prisma } from '@/lib/db'
import { getSession } from '@/lib/session'
import { revalidatePath } from 'next/cache'
import { getAppSettings, parseCategories } from '@/lib/settings'
import { sanitizeSkills } from '@/lib/skills'

export async function updateSettings(data: {
  appName: string
  supportEmail: string
  defaultPriority: string
  autoAssignmentEnabled: boolean
  notifyNewUser: boolean
  notifyCriticalTicket: boolean
  slaCriticalHours: number
  slaHighHours: number
  slaMediumHours: number
  slaLowHours: number
  businessHoursStart: string
  businessHoursEnd: string
  workDays: string
  pauseSlaOnWeekends: boolean
  enableAiTriage: boolean
  aiConfidenceThreshold: number
  fallbackHeuristicsEnabled: boolean
  autoApproveDomain: string
  maintenanceMode: boolean
  categoriesList: string
  cannedResponses: string
}) {
  const session = await getSession()
  if (!session || session.role !== 'ADMIN') {
    throw new Error('Unauthorized')
  }

  if (!data.appName.trim()) {
    throw new Error('App Name is required')
  }

  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!data.supportEmail || !emailRegex.test(data.supportEmail)) {
    throw new Error('Valid Support Email is required')
  }

  await prisma.appSettings.upsert({
    where: { id: 'singleton' },
    update: {
      appName: data.appName,
      supportEmail: data.supportEmail,
      defaultPriority: data.defaultPriority,
      autoAssignmentEnabled: data.autoAssignmentEnabled,
      notifyNewUser: data.notifyNewUser,
      notifyCriticalTicket: data.notifyCriticalTicket,
      slaCriticalHours: data.slaCriticalHours,
      slaHighHours: data.slaHighHours,
      slaMediumHours: data.slaMediumHours,
      slaLowHours: data.slaLowHours,
      businessHoursStart: data.businessHoursStart,
      businessHoursEnd: data.businessHoursEnd,
      workDays: data.workDays,
      pauseSlaOnWeekends: data.pauseSlaOnWeekends,
      enableAiTriage: data.enableAiTriage,
      aiConfidenceThreshold: data.aiConfidenceThreshold,
      fallbackHeuristicsEnabled: data.fallbackHeuristicsEnabled,
      autoApproveDomain: data.autoApproveDomain,
      maintenanceMode: data.maintenanceMode,
      categoriesList: data.categoriesList,
      cannedResponses: data.cannedResponses,
    },
    create: {
      id: 'singleton',
      appName: data.appName,
      supportEmail: data.supportEmail,
      defaultPriority: data.defaultPriority,
      autoAssignmentEnabled: data.autoAssignmentEnabled,
      notifyNewUser: data.notifyNewUser,
      notifyCriticalTicket: data.notifyCriticalTicket,
      slaCriticalHours: data.slaCriticalHours,
      slaHighHours: data.slaHighHours,
      slaMediumHours: data.slaMediumHours,
      slaLowHours: data.slaLowHours,
      businessHoursStart: data.businessHoursStart,
      businessHoursEnd: data.businessHoursEnd,
      workDays: data.workDays,
      pauseSlaOnWeekends: data.pauseSlaOnWeekends,
      enableAiTriage: data.enableAiTriage,
      aiConfidenceThreshold: data.aiConfidenceThreshold,
      fallbackHeuristicsEnabled: data.fallbackHeuristicsEnabled,
      autoApproveDomain: data.autoApproveDomain,
      maintenanceMode: data.maintenanceMode,
      categoriesList: data.categoriesList,
      cannedResponses: data.cannedResponses,
    }
  })

  // Revalidate the route so UI updates
  revalidatePath('/admin/settings')

  return { success: true }
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
