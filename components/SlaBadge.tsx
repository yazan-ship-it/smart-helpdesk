'use client'

import { useEffect, useState } from 'react'
import { getSlaStatus } from '@/lib/sla'
import { Clock } from 'lucide-react'
import { useTranslation } from '@/lib/i18n'

export function SlaBadge({ deadline }: { deadline: string }) {
  const { locale } = useTranslation()
  const [, setTick] = useState(0)

  useEffect(() => {
    const int = setInterval(() => {
      setTick((t) => t + 1)
    }, 60000)
    return () => clearInterval(int)
  }, [])

  const status = getSlaStatus(new Date(deadline), new Date(), locale)

  if (status.isBreached) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide shadow-sm border text-rose-600 bg-rose-500/10 border-rose-200 animate-pulse">
        <Clock className="w-3.5 h-3.5" />
        {status.label}
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide shadow-sm border bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20">
      <Clock className="w-3.5 h-3.5" />
      {status.label}
    </span>
  )
}
