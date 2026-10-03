/**
 * Configuration for SLA Business Hours calculation.
 */
export interface SLAConfig {
  /** Hour of the day business starts (0-23) */
  startHour: number;
  /** Minute of the hour business starts (0-59) */
  startMinute: number;
  /** Hour of the day business ends (0-23) */
  endHour: number;
  /** Minute of the hour business ends (0-59) */
  endMinute: number;
  /** Array of work days, where 0 = Sunday, 1 = Monday, ..., 6 = Saturday */
  workDays: number[];
  /** Whether to pause the SLA countdown outside business hours and on weekends */
  pauseOnWeekends: boolean;
}

/**
 * Result of the SLA status check.
 */
export interface SLAStatus {
  isBreached: boolean;
  label: string;
  minutesLeft: number;
}

/**
 * Finds the next valid business time given a date.
 * If the provided date is within business hours, it returns the date itself.
 * Otherwise, it advances to the start of the next valid business day.
 * 
 * @param date - The starting date/time.
 * @param config - The SLA configuration.
 * @returns The next valid business time.
 */
function getNextValidTime(date: Date, config: SLAConfig): Date {
  const cur = new Date(date.getTime());
  
  while (true) {
    const day = cur.getDay();
    const isWorkDay = config.workDays.includes(day);
    
    const startOfBiz = new Date(cur.getTime());
    startOfBiz.setHours(config.startHour, config.startMinute, 0, 0);
    
    const endOfBiz = new Date(cur.getTime());
    endOfBiz.setHours(config.endHour, config.endMinute, 0, 0);

    if (isWorkDay) {
      if (cur < startOfBiz) {
        return startOfBiz;
      }
      if (cur < endOfBiz) {
        return cur;
      }
    }
    
    // Move to the start of the next day
    cur.setDate(cur.getDate() + 1);
    cur.setHours(0, 0, 0, 0);
  }
}

/**
 * Calculates the SLA deadline based on business hours and work days.
 * 
 * Pure function. Uses native JavaScript Date math.
 * 
 * @param startDate - The time the ticket was created or SLA began.
 * @param requiredHours - The number of hours permitted by the SLA.
 * @param config - The business hours configuration.
 * @returns A Date object representing the SLA deadline.
 */
export function calculateBusinessHoursDeadline(
  startDate: Date,
  requiredHours: number,
  config: SLAConfig
): Date {
  if (
    config.startHour > config.endHour || 
    (config.startHour === config.endHour && config.startMinute >= config.endMinute)
  ) {
    throw new Error("Invalid SLA config: start time must be before end time.");
  }
  if (config.workDays.length === 0) {
    throw new Error("Invalid SLA config: workDays must contain at least one day.");
  }

  // If we shouldn't pause, calculate a strict physical time deadline.
  if (!config.pauseOnWeekends) {
    return new Date(startDate.getTime() + requiredHours * 60 * 60 * 1000);
  }

  let remainingMinutes = requiredHours * 60;
  let current = getNextValidTime(startDate, config);

  while (remainingMinutes > 0) {
    const endOfBiz = new Date(current.getTime());
    endOfBiz.setHours(config.endHour, config.endMinute, 0, 0);

    const minutesLeftToday = (endOfBiz.getTime() - current.getTime()) / 60000;

    if (remainingMinutes <= minutesLeftToday) {
      // We can finish within this business day
      current.setTime(current.getTime() + remainingMinutes * 60000);
      remainingMinutes = 0;
    } else {
      // Consume the rest of the day, then jump to next available day
      remainingMinutes -= minutesLeftToday;
      current.setDate(current.getDate() + 1);
      current.setHours(0, 0, 0, 0);
      current = getNextValidTime(current, config);
    }
  }

  return current;
}

/**
 * Calculates the current SLA status based on the deadline.
 * 
 * Pure function. Compares the deadline against the given time.
 * 
 * @param deadline - The calculated SLA deadline.
 * @param now - The current time (defaults to a new Date instance).
 * @returns An SLAStatus object containing breach status, human-readable label, and remaining minutes.
 */
export function getSlaStatus(deadline: Date, now: Date = new Date(), locale: 'en' | 'ar' = 'en'): SLAStatus {
  const diffMs = deadline.getTime() - now.getTime();
  const isBreached = diffMs <= 0;
  
  // Calculate absolute minutes difference (ignoring trailing seconds)
  const absMinutes = Math.floor(Math.abs(diffMs) / 60000);
  const hours = Math.floor(absMinutes / 60);
  const minutes = absMinutes % 60;
  
  const diffMinutes = isBreached ? -absMinutes : absMinutes;

  const label = locale === 'ar'
    ? (isBreached ? `تجاوز الموعد بـ ${hours}س ${minutes}د` : `متبقي ${hours}س ${minutes}د`)
    : (isBreached ? `Breached by ${hours}h ${minutes}m` : `${hours}h ${minutes}m left`);

  return {
    isBreached,
    label,
    minutesLeft: diffMinutes
  };
}

const SLA_STOPPED = ['RESOLVED', 'CLOSED']

/** Prisma `where` for tickets that missed their SLA: resolved late, or still open past the deadline. */
export function slaBreachedWhere(now: Date = new Date()) {
  return {
    OR: [{ slaBreached: true }, { status: { notIn: SLA_STOPPED }, slaDeadline: { lt: now } }],
  }
}

/**
 * Fields to store when a ticket moves to `status`: when it was resolved/closed,
 * and whether that happened after the SLA deadline. Reopening clears the
 * timestamps but keeps a breach that already happened.
 */
export function statusChangeFields(
  ticket: { slaDeadline: Date | null; resolvedAt: Date | null; slaBreached: boolean },
  status: string,
  now: Date = new Date(),
) {
  if (SLA_STOPPED.includes(status)) {
    const resolvedAt = ticket.resolvedAt ?? now
    return {
      resolvedAt,
      closedAt: status === 'CLOSED' ? now : null,
      slaBreached: ticket.slaBreached || (ticket.slaDeadline !== null && resolvedAt > ticket.slaDeadline),
    }
  }
  return { resolvedAt: null, closedAt: null }
}

/** The admin's SLA settings (AppSettings); missing values fall back to the defaults */
export type SlaSettings = {
  slaCriticalHours: number
  slaHighHours: number
  slaMediumHours: number
  slaLowHours: number
  workDays: string
  businessHoursStart: string
  businessHoursEnd: string
  pauseSlaOnWeekends: boolean
} | null | undefined

const DAY_NUMBERS: Record<string, number> = { Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6 }

/** Resolution deadline for a ticket of `priority` whose SLA clock starts at `from` */
export function slaDeadlineFor(priority: string, settings: SlaSettings, from: Date = new Date()): Date {
  const hours =
    priority === 'CRITICAL' ? settings?.slaCriticalHours ?? 4
    : priority === 'HIGH' ? settings?.slaHighHours ?? 24
    : priority === 'LOW' ? settings?.slaLowHours ?? 72
    : settings?.slaMediumHours ?? 48

  let days: unknown
  try {
    days = JSON.parse(settings?.workDays ?? '')
  } catch {
    days = null
  }
  const workDays = (Array.isArray(days) ? days : ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'])
    .map((d) => DAY_NUMBERS[d as string])
    .filter((n): n is number => n !== undefined)

  const [startHour, startMinute] = (settings?.businessHoursStart ?? '09:00').split(':').map(Number)
  const [endHour, endMinute] = (settings?.businessHoursEnd ?? '17:00').split(':').map(Number)

  return calculateBusinessHoursDeadline(from, hours, {
    startHour,
    startMinute,
    endHour,
    endMinute,
    workDays,
    pauseOnWeekends: settings?.pauseSlaOnWeekends ?? true,
  })
}
