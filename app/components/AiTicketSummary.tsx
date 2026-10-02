'use client'

import { useState } from 'react'
import { Loader2, RotateCcw, Sparkles } from 'lucide-react'
import { useTranslation } from '@/lib/i18n'

type Summary = { summary: string; nextAction: string }

/** On-demand Gemini summary of a ticket and its discussion, for IT staff. */
export default function AiTicketSummary({ ticketId, onInsert }: { ticketId: string; onInsert: (text: string) => void }) {
  const { t, locale } = useTranslation()
  const [summary, setSummary] = useState<Summary | null>(null)
  const [status, setStatus] = useState<'idle' | 'loading' | 'not_configured' | 'rate_limited' | 'failed'>('idle')

  const generate = async () => {
    setStatus('loading')
    try {
      const res = await fetch(`/api/ai/summarize/${ticketId}?locale=${locale}`, { method: 'POST' })
      if (res.status === 503) return setStatus('not_configured')
      if (res.status === 429) return setStatus('rate_limited')
      if (!res.ok) return setStatus('failed')
      setSummary((await res.json()) as Summary)
      setStatus('idle')
    } catch {
      setStatus('failed')
    }
  }

  return (
    <section className="rounded-2xl border border-indigo-500/30 bg-card p-5 shadow-sm space-y-3" aria-live="polite">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <span className="w-7 h-7 rounded-lg bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <Sparkles className="w-3.5 h-3.5" />
          </span>
          <div>
            <h2 className="text-xs font-bold text-foreground">{t('ai.summaryHeading')}</h2>
            {!summary && <p className="text-[11px] text-muted-foreground mt-0.5 max-w-md">{t('ai.summaryIntro')}</p>}
          </div>
        </div>
        <button
          type="button"
          onClick={generate}
          disabled={status === 'loading'}
          className="btn btn-secondary btn-sm inline-flex items-center gap-1.5 disabled:opacity-50"
        >
          {status === 'loading' ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : summary ? (
            <RotateCcw className="w-3.5 h-3.5" />
          ) : (
            <Sparkles className="w-3.5 h-3.5" />
          )}
          {status === 'loading' ? t('ai.summarizing') : summary ? t('ai.regenerate') : t('ai.summarize')}
        </button>
      </div>

      {(status === 'not_configured' || status === 'rate_limited' || status === 'failed') && (
        <p className="text-xs text-red-600 dark:text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl p-2.5">
          {t(`ai.summaryErrors.${status}`)}
        </p>
      )}

      {summary && (
        <div className="space-y-3 text-xs">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">{t('ai.summaryLabel')}</p>
            <p className="text-foreground leading-relaxed">{summary.summary}</p>
          </div>
          <div className="p-3 rounded-xl bg-background border border-border">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">{t('ai.nextActionLabel')}</p>
            <p className="text-foreground leading-relaxed">{summary.nextAction}</p>
            <button
              type="button"
              onClick={() => onInsert(summary.nextAction)}
              className="mt-2 text-indigo-600 dark:text-indigo-400 hover:underline font-medium cursor-pointer"
            >
              + {t('ai.insertIntoReply')}
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground">{t('ai.summaryDisclaimer')}</p>
        </div>
      )}
    </section>
  )
}
