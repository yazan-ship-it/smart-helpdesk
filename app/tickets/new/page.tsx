import { isAiConfigured } from '@/lib/gemini'
import { PRIORITIES, type Priority } from '@/lib/ai/triage'
import { getAppSettings, parseCategories } from '@/lib/settings'
import NewTicketClient from './NewTicketClient'

export const metadata = {
  title: 'Create Ticket',
  description: 'Submit a new support ticket.',
}

export default async function NewTicketPage() {
  const settings = await getAppSettings()

  const defaultPriority = PRIORITIES.includes(settings?.defaultPriority as Priority)
    ? (settings!.defaultPriority as Priority)
    : 'MEDIUM'

  return (
    <NewTicketClient
      categories={parseCategories(settings?.categoriesList)}
      defaultPriority={defaultPriority}
      slaHours={{
        CRITICAL: settings?.slaCriticalHours ?? 4,
        HIGH: settings?.slaHighHours ?? 24,
        MEDIUM: settings?.slaMediumHours ?? 48,
        LOW: settings?.slaLowHours ?? 72,
      }}
      businessHours={{ start: settings?.businessHoursStart ?? '09:00', end: settings?.businessHoursEnd ?? '17:00' }}
      // Show the suggestion panel only if it can actually produce something
      suggestionsEnabled={
        (settings?.enableAiTriage ?? true) && (isAiConfigured() || (settings?.fallbackHeuristicsEnabled ?? true))
      }
    />
  )
}
