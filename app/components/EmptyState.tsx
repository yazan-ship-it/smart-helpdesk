'use client'

import { SearchX } from 'lucide-react'
import { useTranslation } from '@/lib/i18n'

interface EmptyStateProps {
  title?: string
  description?: string
  icon?: React.ReactNode
  children?: React.ReactNode
}

export default function EmptyState({ 
  title, 
  description,
  icon = <SearchX className="w-8 h-8 text-[var(--text-muted)]" />,
  children
}: EmptyStateProps) {
  const { locale } = useTranslation()
  const displayTitle = title || (locale === 'ar' ? 'لا توجد تذاكر' : 'No tickets found')
  const displayDescription = description || (locale === 'ar' ? 'جرب تعديل خيارات البحث أو الفلاتر.' : 'Try adjusting your filters or create a new ticket.')

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center border border-dashed border-[var(--border)] rounded-xl" style={{ background: 'var(--bg-surface)' }}>
      <div className="w-16 h-16 bg-[var(--bg-elevated)] rounded-full flex items-center justify-center mb-4 shadow-sm border border-[var(--border)]">
        {icon}
      </div>
      <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>{displayTitle}</h3>
      <p className="text-sm mt-1.5 max-w-sm mx-auto leading-relaxed" style={{ color: 'var(--text-muted)' }}>{displayDescription}</p>
      {children && <div className="mt-6">{children}</div>}
    </div>
  )
}
