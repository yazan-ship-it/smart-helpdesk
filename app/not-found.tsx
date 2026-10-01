'use client'

import Link from 'next/link'
import { useTranslation } from '@/lib/i18n'

export default function NotFound() {
  const { locale } = useTranslation()
  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="text-center">
        <h1 className="text-6xl font-bold gradient-text mb-4">404</h1>
        <p className="text-xl font-semibold mb-2 text-foreground">
          {locale === 'ar' ? 'الصفحة غير موجودة' : 'Page Not Found'}
        </p>
        <p className="text-sm mb-6 text-muted-foreground">
          {locale === 'ar' ? 'الصفحة التي تبحث عنها غير متوفرة أو تم نقلها.' : "The page you're looking for doesn't exist."}
        </p>
        <Link href="/tickets" className="btn btn-primary inline-flex">
          {locale === 'ar' ? 'الانتقال إلى التذاكر' : 'Go to Tickets'}
        </Link>
      </div>
    </div>
  )
}
