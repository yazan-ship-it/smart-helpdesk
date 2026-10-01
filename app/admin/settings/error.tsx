'use client'

import { useEffect } from 'react'
import { AlertTriangle } from 'lucide-react'
import { useTranslation } from '@/lib/i18n'

export default function SettingsError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const { locale } = useTranslation()

  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center h-[50vh] space-y-4">
      <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-500">
        <AlertTriangle className="w-6 h-6" />
      </div>
      <h2 className="text-xl font-bold text-foreground">
        {locale === 'ar' ? 'حدث خطأ غير متوقع!' : 'Something went wrong!'}
      </h2>
      <p className="text-muted-foreground text-sm">
        {locale === 'ar' ? 'فشل تحميل بيانات الإعدادات.' : 'Failed to load settings data.'}
      </p>
      <button
        onClick={() => reset()}
        className="btn btn-primary"
      >
        {locale === 'ar' ? 'إعادة المحاولة' : 'Try again'}
      </button>
    </div>
  )
}
