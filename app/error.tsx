'use client'

import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'
import { AlertTriangle } from 'lucide-react'
import { useTranslation } from '@/lib/i18n'

/** Shown instead of a page that crashed, inside the root layout (theme and language still apply) */
export default function ErrorPage({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const { t } = useTranslation()

  useEffect(() => {
    // Errors caught by a boundary aren't "unhandled", so report them explicitly
    Sentry.captureException(error)
  }, [error])

  return (
    <div role="alert" className="flex flex-col items-center justify-center min-h-[60vh] gap-4 p-6 text-center">
      <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-500">
        <AlertTriangle className="w-6 h-6" />
      </div>
      <h1 className="text-xl font-bold text-foreground">{t('errorPage.title')}</h1>
      <p className="text-sm text-muted-foreground max-w-md">{t('errorPage.description')}</p>
      {/* The digest matches the server log entry, so support can find the error */}
      {error.digest && <p className="text-xs font-mono text-muted-foreground">{t('errorPage.reference', { digest: error.digest })}</p>}
      <button type="button" onClick={() => retry()} className="btn btn-primary">
        {t('errorPage.retry')}
      </button>
    </div>
  )
}
