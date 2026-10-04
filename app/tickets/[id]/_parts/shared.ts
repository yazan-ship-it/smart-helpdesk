import type { AttachmentInfo } from '@/lib/uploads'
import type { Status } from '@/lib/ticket-status'

import type { Priority } from '@/lib/ticket-display'

export type { Priority }
export type Role = 'EMPLOYEE' | 'IT_SUPPORT' | 'ADMIN'

/** What the ticket pages pass to TicketDetailClient */
export type TicketDetailData = {
  id: string
  ticketNumber: number
  title: string
  description: string
  category: string
  priority: Priority
  status: Status
  attachments: AttachmentInfo[]
  slaDeadline: string | null
  slaBreached: boolean | null
  csatRating: number | null
  csatFeedback: string | null
  resolvedAt: string | null
  closedAt: string | null
  createdAt: string
  updatedAt: string
  createdBy: { id: string; name: string; email: string }
  assignedTo: { id: string; name: string } | null
  assignedToId: string | null
  comments: Array<{
    id: string
    content: string
    isInternal: boolean
    createdAt: string
    author: { name: string; role: Role }
  }>
  ticketHistories: Array<{
    id: string
    action: string
    event: string | null
    meta: string | null
    createdAt: string
    user: { name: string }
  }>
}

export type AgentOption = { id: string; name: string; skills: string; isAvailable: boolean }

export { statusBadgeClass, priorityBadgeClass, getInitials, formatBytes } from '@/lib/ticket-display'
