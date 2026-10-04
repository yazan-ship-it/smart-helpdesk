'use client'

import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'
import { AlertTriangle } from 'lucide-react'
import { useTranslation } from '@/lib/i18n'

export default function SettingsError({
  error,
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  const { t } = useTranslation()

  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center h-[50vh] space-y-4">
      <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-500">
        <AlertTriangle className="w-6 h-6" />
      </div>
      <h2 className="text-xl font-bold text-foreground">
        {t('settingsError.somethingWentWrong')}
      </h2>
      <p className="text-muted-foreground text-sm">
        {t('settingsError.failedToLoadSettingsData')}
      </p>
      <button
        onClick={() => retry()}
        className="btn btn-primary"
      >
        {t('settingsError.tryAgain')}
      </button>
    </div>
  )
}
