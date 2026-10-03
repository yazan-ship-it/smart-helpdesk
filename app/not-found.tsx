'use client'

import Link from 'next/link'
import { useTranslation } from '@/lib/i18n'

export default function NotFound() {
  const { t } = useTranslation()
  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="text-center">
        <h1 className="text-6xl font-bold gradient-text mb-4">404</h1>
        <p className="text-xl font-semibold mb-2 text-foreground">
          {t('notFound.pageNotFound')}
        </p>
        <p className="text-sm mb-6 text-muted-foreground">
          {t('notFound.thePageYouReLooking')}
        </p>
        <Link href="/tickets" className="btn btn-primary inline-flex">
          {t('notFound.goToTickets')}
        </Link>
      </div>
    </div>
  )
}
