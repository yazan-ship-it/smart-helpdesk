export const TICKET_CATEGORIES = [
  'Hardware',
  'Software',
  'Network',
  'Email & Communication',
  'Access & Permissions',
  'Printer',
  'Security',
  'Other',
] as const

export type TicketCategory = typeof TICKET_CATEGORIES[number]
