/** Small display helpers shared by the ticket list, the ticket page and the drawer */

import type { Status } from '@/lib/ticket-status'

export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

export function statusBadgeClass(s: Status) {
  switch (s) {
    case 'OPEN': return 'badge badge-open'
    case 'ASSIGNED': return 'badge badge-assigned'
    case 'IN_PROGRESS': return 'badge badge-in-progress'
    case 'RESOLVED': return 'badge badge-resolved'
    case 'CLOSED': return 'badge badge-closed'
  }
}

export function priorityBadgeClass(p: Priority) {
  switch (p) {
    case 'LOW': return 'badge badge-low'
    case 'MEDIUM': return 'badge badge-medium'
    case 'HIGH': return 'badge badge-high'
    case 'CRITICAL': return 'badge badge-critical'
  }
}

/** Two letters for an avatar: "Bob Williams" → "BW" */
export function getInitials(name: string) {
  if (!name) return 'U'
  const parts = name.trim().split(' ')
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
