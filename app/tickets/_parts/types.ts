import type { Status } from '@/lib/ticket-status'
import type { Priority } from '@/lib/ticket-display'

export type Role = 'EMPLOYEE' | 'IT_SUPPORT' | 'ADMIN'

/** A ticket as the list pages pass it to TicketListClient */
export type TicketData = {
  id: string
  ticketNumber: number
  title: string
  description: string
  category: string
  priority: Priority
  status: Status
  createdAt: string
  updatedAt: string
  createdBy: { name: string }
  assignedToId: string | null
  assignedTo: { name: string } | null
  _count: { comments: number; attachments: number }
  slaDeadline?: string
}

/** The pill style of an active filter */
export const ACTIVE_PILL = {
  background: 'var(--brand-muted)',
  borderColor: 'var(--border-focus)',
  color: 'var(--brand)',
} as const
