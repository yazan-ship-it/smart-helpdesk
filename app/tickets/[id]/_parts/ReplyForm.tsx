'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, MessageSquare, Send } from 'lucide-react'
import { addComment } from '@/app/actions/tickets'
import type { CannedResponse } from '@/lib/settings'
import { useTranslation } from '@/lib/i18n'

/**
 * The reply box. Staff can also write internal notes and use canned replies.
 * The text lives in the parent so the AI summary can insert its suggestion.
 */
export default function ReplyForm({
  ticketId,
  isStaff,
  cannedResponses,
  text,
  setText,
}: {
  ticketId: string
  isStaff: boolean
  cannedResponses: CannedResponse[]
  text: string
  setText: React.Dispatch<React.SetStateAction<string>>
}) {
  const router = useRouter()
  const { t } = useTranslation()
  const [isInternalNote, setIsInternalNote] = useState(false)
  const [isPending, startTransition] = useTransition()

  // The reply box says who the reply is for
  const hint = isInternalNote
    ? 'ticketPage.typePrivateTechnicalNotes'
    : isStaff ? 'ticketPage.typeDiagnosticNotesRequesterReply' : 'ticketPage.replyToSupport'

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!text.trim()) return

    startTransition(async () => {
      try {
        const result = await addComment(ticketId, text, isInternalNote)
        if (result?.error) {
          toast.error(t(`errors.${result.error}`, result.params))
        } else {
          setText('')
          setIsInternalNote(false)
          toast.success(isInternalNote ? t('toasts.internalNoteAdded') : t('toasts.commentPosted'))
          router.refresh()
        }
      } catch {
        toast.error(t('toasts.commentFailed'))
      }
    })
  }

  return (
    <div className="card p-5 mt-6 border-border bg-card backdrop-blur-md">
      <form onSubmit={submit} className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-1">
          <span className="flex items-center gap-2 text-xs font-semibold text-foreground">
            <MessageSquare className="w-3.5 h-3.5 text-indigo-700 dark:text-indigo-400" />
            {t('ticketPage.addAResponseOrUpdate')}
          </span>
          {isStaff && (
            <label className="flex items-center gap-2 text-[11px] font-semibold text-amber-700 dark:text-amber-400 cursor-pointer select-none bg-amber-500/10 hover:bg-amber-500/20 px-2 py-1 rounded-md transition-colors border border-amber-500/20">
              <input type="checkbox" checked={isInternalNote} onChange={(e) => setIsInternalNote(e.target.checked)} className="rounded border-amber-500/30 text-amber-600 focus:ring-amber-500/30" />
              {t('ticketPage.privateInternalNoteItOnly')}
            </label>
          )}
        </div>

        {isStaff && cannedResponses.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pb-1">
            {cannedResponses.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setText((prev) => (prev ? `${prev}\n\n${r.content}` : r.content))}
                className="text-[10px] font-medium px-2 py-1 rounded-full border border-border bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors"
              >
                {r.title}
              </button>
            ))}
          </div>
        )}

        <textarea
          rows={3}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t(hint)}
          aria-label={t(hint)}
          className={`w-full rounded-xl p-3 text-sm outline-none transition-all focus:ring-2 resize-none ${isInternalNote ? 'bg-amber-500/5 border-amber-500/30 text-amber-900 dark:text-amber-100 placeholder:text-amber-700/50 focus:border-amber-500/60 focus:ring-amber-500/20 hover:border-amber-500/40' : 'bg-background dark:bg-background border border-border text-foreground dark:text-foreground placeholder:text-muted-foreground focus:border-indigo-500/60 focus:ring-indigo-500/20 hover:border-border'}`}
          disabled={isPending}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') submit(e)
          }}
        />

        <div className="flex items-center justify-end">
          <button type="submit" disabled={isPending || !text.trim()} className="btn btn-primary btn-sm">
            {isPending ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>{t('ticketPage.posting')}</span>
              </>
            ) : (
              <>
                <Send className="w-3.5 h-3.5" />
                <span>{t('ticketPage.postResponse')}</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
