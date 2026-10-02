export function formatRelativeTime(dateStr: string | Date, locale: 'en' | 'ar' = 'en'): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)
  
  if (diffInSeconds < 60) return locale === 'ar' ? 'الآن' : 'Just now'
  
  const diffInMinutes = Math.floor(diffInSeconds / 60)
  const rtf = new Intl.RelativeTimeFormat(locale === 'ar' ? 'ar' : 'en', { numeric: 'auto' })
  
  if (diffInMinutes < 60) {
    return rtf.format(-diffInMinutes, 'minute')
  }
  
  const diffInHours = Math.floor(diffInMinutes / 60)
  if (diffInHours < 24) {
    return rtf.format(-diffInHours, 'hour')
  }
  
  // Check if it's yesterday
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  
  const timeString = date.toLocaleTimeString(locale === 'ar' ? 'ar-EG' : 'en-US', { hour: 'numeric', minute: '2-digit' })
  
  if (date.getDate() === yesterday.getDate() && date.getMonth() === yesterday.getMonth() && date.getFullYear() === yesterday.getFullYear()) {
    return locale === 'ar' ? `أمس في ${timeString}` : `Yesterday at ${timeString}`
  }
  
  const diffInDays = Math.floor(diffInHours / 24)
  if (diffInDays < 7) {
    return rtf.format(-diffInDays, 'day')
  }
  
  return date.toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US', { month: 'short', day: 'numeric', year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined }) + (locale === 'ar' ? ` في ${timeString}` : ` at ${timeString}`)
}

/** The one display format for ticket numbers, e.g. 105 → "TICK-105". */
export function formatTicketNumber(ticketNumber: number): string {
  return `TICK-${String(ticketNumber).padStart(3, '0')}`
}
