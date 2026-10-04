/** Ticket lifecycle, shared by the server actions and the screens that offer the next step */

export type Status = 'OPEN' | 'ASSIGNED' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED'

/**
 * The strict forward-only state machine: the only status each one can move to.
 * (The requester reopening a finished ticket is a separate action.)
 */
export const NEXT_STATUSES: Record<Status, Status[]> = {
  OPEN: ['ASSIGNED'],
  ASSIGNED: ['IN_PROGRESS'],
  IN_PROGRESS: ['RESOLVED'],
  RESOLVED: ['CLOSED'],
  CLOSED: [],
}

export function isValidTransition(from: Status, to: Status): boolean {
  return NEXT_STATUSES[from]?.includes(to) ?? false
}
