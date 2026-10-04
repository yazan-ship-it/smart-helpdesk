'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Check, CheckCircle2 } from 'lucide-react'
import { confirmTicketResolution, reopenTicket, submitCsatRating } from '@/app/actions/tickets'
import { useTranslation } from '@/lib/i18n'
import type { TicketDetailData } from './shared'

/**
 * What the requester sees above the ticket: confirm or reopen a resolved
 * ticket, rate a closed one, and the progress stepper.
 */
export default function EmployeePanels({ ticket }: { ticket: TicketDetailData }) {
  const router = useRouter()
  const { t } = useTranslation()
  const [reopenReason, setReopenReason] = useState('')
  const [showReopenDialog, setShowReopenDialog] = useState(false)
  const [csatRatingValue, setCsatRatingValue] = useState(0)
  const [csatFeedbackText, setCsatFeedbackText] = useState('')
  const [isPendingAction, startTransitionAction] = useTransition()

  return (
    <>
      {ticket.status === 'RESOLVED' && (
        <div className="mb-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm animate-fade-in">
          <div className="flex items-center gap-3 text-emerald-800 dark:text-emerald-300">
            <CheckCircle2 className="w-6 h-6 shrink-0" />
            <p className="font-semibold text-[15px]">{t('ticketPage.theItTeamMarkedThis')}</p>
          </div>
          <div className="flex items-center gap-3 shrink-0 w-full md:w-auto">
            <button
              onClick={() => setShowReopenDialog(true)}
              disabled={isPendingAction}
              className="btn btn-secondary flex-1 md:flex-auto bg-card"
            >
              ↺ {t('ticketPage.issueStillPersists')}
            </button>
            <button
              onClick={() => {
                startTransitionAction(async () => {
                  const res = await confirmTicketResolution(ticket.id)
                  if (res.error) toast.error(t(`errors.${res.error}`, res.params))
                  else { toast.success(t('toasts.ticketClosed')); router.refresh() }
                })
              }}
              disabled={isPendingAction}
              className="btn btn-primary flex-1 md:flex-auto bg-emerald-600 hover:bg-emerald-700 text-white border-0"
            >
              ✓ {t('ticketPage.confirmClose')}
            </button>
          </div>
        </div>
      )}

      {showReopenDialog && (
        <div className="mb-6 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5 shadow-sm animate-fade-in space-y-3">
          <h3 className="font-semibold text-amber-800 dark:text-amber-300">{t('ticketPage.reopenTicket')}</h3>
          <textarea
            value={reopenReason}
            onChange={(e) => setReopenReason(e.target.value)}
            placeholder={t('ticketPage.pleaseDescribeWhyThisIssue')}
            aria-label={t('ticketPage.pleaseDescribeWhyThisIssue')}
            className="w-full p-3 rounded-xl border border-amber-500/30 bg-background text-sm focus:ring-2 focus:ring-amber-500/20 outline-none"
            rows={3}
          />
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowReopenDialog(false)} className="btn btn-secondary text-sm">{t('ticketPage.cancel')}</button>
            <button
              onClick={() => {
                startTransitionAction(async () => {
                  const res = await reopenTicket(ticket.id, reopenReason)
                  if (res.error) toast.error(t(`errors.${res.error}`, res.params))
                  else { toast.success(t('ticketPage.ticketReopened')); setShowReopenDialog(false); setReopenReason(''); router.refresh() }
                })
              }}
              disabled={isPendingAction || reopenReason.trim().length < 5}
              className="btn bg-amber-600 hover:bg-amber-700 text-white text-sm border-0"
            >
              {t('ui.submitReopen')}
            </button>
          </div>
        </div>
      )}

      {ticket.status === 'CLOSED' && ticket.csatRating === null && (
        <div className="mb-6 rounded-2xl border border-indigo-500/30 bg-indigo-500/10 p-5 shadow-sm animate-fade-in text-center space-y-4">
          <div>
            <h3 className="font-bold text-indigo-800 dark:text-indigo-300">{t('ticketPage.howWasYourExperience')}</h3>
            <p className="text-sm text-indigo-700/80 dark:text-indigo-400/80">{t('ticketPage.pleaseRateTheSupportYou')}</p>
          </div>
          <div className="flex items-center justify-center gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setCsatRatingValue(star)}
                className={`w-10 h-10 transition-transform hover:scale-110 ${csatRatingValue >= star ? 'text-amber-400 drop-shadow-sm' : 'text-indigo-500/30'} text-3xl`}
              >
                ★
              </button>
            ))}
          </div>
          {csatRatingValue > 0 && (
            <div className="max-w-md mx-auto space-y-3 animate-fade-in">
              <textarea
                value={csatFeedbackText}
                onChange={(e) => setCsatFeedbackText(e.target.value)}
                placeholder={t('ticketPage.optionalFeedback')}
                aria-label={t('ticketPage.optionalFeedback')}
                className="w-full p-3 rounded-xl border border-indigo-500/30 bg-background text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none"
                rows={2}
              />
              <button
                onClick={() => {
                  startTransitionAction(async () => {
                    const res = await submitCsatRating(ticket.id, csatRatingValue, csatFeedbackText)
                    if (res.error) toast.error(t(`errors.${res.error}`, res.params))
                    else { toast.success(t('toasts.thanksFeedback')); router.refresh() }
                  })
                }}
                disabled={isPendingAction}
                className="btn btn-primary w-full shadow-sm"
              >
                {t('ui.submitFeedback')}
              </button>
            </div>
          )}
        </div>
      )}

      <StatusStepper status={ticket.status} />
    </>
  )
}

const STEPS = ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] as const
const STEP_LABEL = {
  OPEN: 'ticketPage.submitted',
  ASSIGNED: 'ticketPage.assigned',
  IN_PROGRESS: 'ticketPage.inProgress',
  RESOLVED: 'ticketPage.resolved',
  CLOSED: 'ticketPage.closed',
} as const

/** Where the ticket is in its lifecycle */
function StatusStepper({ status }: { status: TicketDetailData['status'] }) {
  const { t } = useTranslation()
  const currentIdx = STEPS.indexOf(status)

  return (
    <div className="mb-10 px-2 sm:px-8 mt-4 animate-fade-in">
      <div className="flex items-center justify-between relative">
        {/* Background Track */}
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-border rounded-full" />

        {/* Active Track */}
        <div
          className="absolute start-0 top-1/2 -translate-y-1/2 h-1 transition-all duration-500 rounded-full"
          style={{ width: `${currentIdx * 25}%`, background: 'var(--brand)' }}
        />

        {STEPS.map((step, idx) => {
          const isCompleted = idx < currentIdx
          const isActive = idx === currentIdx

          return (
            <div key={step} className="relative z-10 flex flex-col items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 border-2 ${
                  isCompleted
                    ? 'text-white shadow-sm'
                    : isActive
                      ? 'bg-background ring-4 ring-indigo-500/20'
                      : 'bg-background border-border text-muted-foreground'
                }`}
                style={isCompleted ? { background: 'var(--brand)', borderColor: 'var(--brand)' } : isActive ? { borderColor: 'var(--brand)', color: 'var(--brand)' } : {}}
              >
                {isCompleted ? <Check className="w-4 h-4" /> : <div className={`w-2.5 h-2.5 rounded-full ${isActive ? 'animate-pulse' : 'bg-transparent'}`} style={isActive ? { background: 'var(--brand)' } : {}} />}
              </div>
              <span className={`text-[11px] font-semibold uppercase tracking-wider absolute top-10 whitespace-nowrap ${isActive ? 'text-foreground' : 'text-muted-foreground'}`}>
                {t(STEP_LABEL[step])}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
