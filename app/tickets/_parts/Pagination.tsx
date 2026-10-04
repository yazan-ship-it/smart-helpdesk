'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useTranslation } from '@/lib/i18n'

/** Previous / next between pages of the ticket list */
export default function Pagination({ page, pageCount, onPage, disabled }: { page: number; pageCount: number; onPage: (page: number) => void; disabled?: boolean }) {
  const { t } = useTranslation()
  if (pageCount <= 1) return null

  return (
    <nav aria-label={t('ticketList.pagination')} className="flex items-center justify-center gap-3 pt-2">
      <button type="button" className="btn btn-secondary btn-sm" disabled={disabled || page <= 1} onClick={() => onPage(page - 1)}>
        <ChevronLeft className="w-3.5 h-3.5 rtl:rotate-180" />
        {t('ticketList.previousPage')}
      </button>
      <span className="text-xs tabular-nums" style={{ color: 'var(--text-muted)' }} aria-live="polite">
        {t('ticketList.pageOf', { page, pages: pageCount })}
      </span>
      <button type="button" className="btn btn-secondary btn-sm" disabled={disabled || page >= pageCount} onClick={() => onPage(page + 1)}>
        {t('ticketList.nextPage')}
        <ChevronRight className="w-3.5 h-3.5 rtl:rotate-180" />
      </button>
    </nav>
  )
}
