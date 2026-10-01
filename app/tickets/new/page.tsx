import { prisma } from '@/lib/db'
import NewTicketClient from './NewTicketClient'

export const metadata = {
  title: 'Create Ticket',
  description: 'Submit a new support ticket.',
}

export default async function NewTicketPage() {
  const settings = await prisma.appSettings.findUnique({
    where: { id: 'singleton' }
  })

  const categories = settings?.categoriesList 
    ? JSON.parse(settings.categoriesList) as string[]
    : [
        'Hardware',
        'Software',
        'Network',
        'Email',
        'Access Issue',
        'Printer',
        'Security',
        'Other'
      ]

  return <NewTicketClient categories={categories} />
}
