'use client'

import { useState, useTransition } from 'react'
import { toggleAvailability } from '@/app/actions/tickets'
import { toast } from 'sonner'
import { Loader2, Wifi, WifiOff } from 'lucide-react'
import { useTranslation } from '@/lib/i18n'

type Props = {
  initialAvailability: boolean
}

export default function AvailabilityToggle({ initialAvailability }: Props) {
  const { t } = useTranslation()
  const [isAvailable, setIsAvailable] = useState(initialAvailability)
  const [isPending, startTransition] = useTransition()

  const handleToggle = () => {
    startTransition(async () => {
      const result = await toggleAvailability()
      if (result.error) {
        toast.error(t(`errors.${result.error}`, result.params))
        return
      }
      setIsAvailable(result.isAvailable)
      if (result.isAvailable) {
        toast.success(
          t('availability.statusSetToAvailableYou')
        )
      } else {
        toast.info(
          t('availability.statusSetToAwayNew')
        )
      }
    })
  }

  const labelText = isAvailable 
    ? (t('availability.available'))
    : (t('availability.away'))

  const titleText = isAvailable
    ? (t('availability.clickToGoAway'))
    : (t('availability.clickToGoAvailable'))

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={isPending}
      title={titleText}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer ${
        isAvailable
          ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20'
          : 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30 hover:bg-amber-500/20'
      }`}
    >
      {isPending ? (
        <Loader2 className="w-3 h-3 animate-spin" />
      ) : isAvailable ? (
        <Wifi className="w-3 h-3" />
      ) : (
        <WifiOff className="w-3 h-3" />
      )}
      <span className="hidden sm:inline">{labelText}</span>
      <span
        className={`w-2 h-2 rounded-full ${isAvailable ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`}
      />
    </button>
  )
}
