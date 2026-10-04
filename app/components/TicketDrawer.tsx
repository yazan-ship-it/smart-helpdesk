'use client'

import { useState, useEffect, useEffectEvent, useTransition, useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ExternalLink, MessageSquare, Clock, User, AlertTriangle, Send, RefreshCw, Layers } from 'lucide-react'
import { formatRelativeTime, formatTicketNumber } from '@/lib/utils'
import Link from 'next/link'
import { toast } from 'sonner'
import { getTicketDetails, updateTicketStatus, addComment, takeOverTicket } from '@/app/actions/tickets'
import confetti from 'canvas-confetti'
import { useIsClient } from '@/lib/useIsClient'
import { useTranslation, getStatusLabel, getPriorityLabel, getCategoryLabel } from '@/lib/i18n'
import AiTranslateButton from '@/app/components/AiTranslateButton'
import AiTicketSummary from '@/app/components/AiTicketSummary'
import type { CannedResponse } from '@/lib/settings'
import { NEXT_STATUSES, type Status } from '@/lib/ticket-status'

type TicketDetails = NonNullable<Awaited<ReturnType<typeof getTicketDetails>>>
type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

function statusBadgeClass(s: Status) {
  switch (s) {
    case 'OPEN': return 'badge badge-open'
    case 'ASSIGNED': return 'badge badge-assigned'
    case 'IN_PROGRESS': return 'badge badge-in-progress'
    case 'RESOLVED': return 'badge badge-resolved'
    case 'CLOSED': return 'badge badge-closed'
  }
}

function priorityBadgeClass(p: Priority) {
  switch (p) {
    case 'LOW': return 'badge badge-low'
    case 'MEDIUM': return 'badge badge-medium'
    case 'HIGH': return 'badge badge-high'
    case 'CRITICAL': return 'badge badge-critical'
  }
}

function getInitials(name: string) {
  if (!name) return 'U'
  const parts = name.trim().split(' ')
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export default function TicketDrawer({
  ticketId,
  isOpen,
  onClose,
  currentUserId,
  canChangeTickets,
  cannedResponses,
}: {
  ticketId: string | null
  isOpen: boolean
  onClose: () => void
  currentUserId: string
  /** IT support claims tickets and changes their status; admins can only reply here */
  canChangeTickets: boolean
  cannedResponses: CannedResponse[]
}) {
  const { t, locale, isRTL } = useTranslation()
  const [ticket, setTicket] = useState<TicketDetails | null>(null)
  // Id of the ticket whose fetch has finished; a spinner shows until it matches ticketId
  const [loadedId, setLoadedId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [commentText, setCommentText] = useState('')
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  // createPortal needs document, so render nothing during SSR
  const mounted = useIsClient()
  const loading = isOpen && !!ticketId && loadedId !== ticketId
  // Another agent's ticket: read-only here until taken over. Finished tickets can't be taken over.
  const ownedByPeer = Boolean(ticket?.assignedToId && ticket.assignedToId !== currentUserId)
  const finished = ticket?.status === 'RESOLVED' || ticket?.status === 'CLOSED'

  // Forget the loaded ticket when the drawer closes so reopening it shows the spinner again
  if (!isOpen && loadedId !== null) setLoadedId(null)

  useEffect(() => {
    if (ticket?.id) {
      scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'instant' })
    }
  }, [ticket?.id])

  const onLoadFailed = useEffectEvent((reason: 'not-found' | 'error') => {
    if (reason === 'not-found') {
      toast.error(t('drawer.ticketNotFoundOrUnauthorized'))
    } else {
      toast.error(t('drawer.failedToLoadTicketDetails'))
    }
    onClose()
  })

  useEffect(() => {
    if (!isOpen || !ticketId) return
    let cancelled = false
    getTicketDetails(ticketId)
      .then((data) => {
        if (cancelled) return
        if (!data) return onLoadFailed('not-found')
        setTicket(data)
        setLoadedId(ticketId)
      })
      .catch(() => {
        if (!cancelled) onLoadFailed('error')
      })
    return () => {
      cancelled = true
    }
  }, [isOpen, ticketId])

  const refreshTicket = async (id: string) => {
    const updated = await getTicketDetails(id)
    if (updated) setTicket(updated)
  }

  const handleStatusTransition = async (nextStatus: Status) => {
    if (!ticket) return
    startTransition(async () => {
      try {
        const result = await updateTicketStatus(ticket.id, nextStatus)
        if (result?.error) {
          toast.error(t(`errors.${result.error}`, result.params))
          return
        }
        toast.success(t('drawer.statusUpdatedTo', { status: getStatusLabel(nextStatus, locale) }))
        if (nextStatus === 'RESOLVED') {
          confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } })
        }
        await refreshTicket(ticket.id)
      } catch {
        toast.error(t('drawer.failedToUpdateStatus'))
      }
    })
  }

  const handleTakeOver = async () => {
    if (!ticket) return
    startTransition(async () => {
      try {
        const result = await takeOverTicket(ticket.id)
        if (result?.error) {
          toast.error(t(`errors.${result.error}`, result.params))
          return
        }
        toast.success(t('drawer.youHaveTakenOverThis'))
        await refreshTicket(ticket.id)
      } catch {
        toast.error(t('drawer.failedToTakeOverTicket'))
      }
    })
  }

  const handleAddComment = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!commentText.trim() || !ticket) return

    startTransition(async () => {
      try {
        const result = await addComment(ticket.id, commentText)
        if (result?.error) {
          toast.error(t(`errors.${result.error}`, result.params))
          return
        }
        toast.success(t('drawer.commentAdded'))
        setCommentText('')
        await refreshTicket(ticket.id)
      } catch {
        toast.error(t('drawer.failedToAddComment'))
      }
    })
  }

  if (!mounted) return null

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs transition-opacity"
            onClick={onClose}
          />
          <motion.div
            initial={{ x: isRTL ? '-100%' : '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: isRTL ? '-100%' : '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-y-0 right-0 rtl:right-auto rtl:left-0 z-50 h-screen w-full sm:w-[480px] md:w-[45%] bg-card text-card-foreground shadow-2xl border-l rtl:border-l-0 rtl:border-r border-border flex flex-col overflow-hidden"
          >
            {/* Drawer Header */}
            <div className="shrink-0 flex items-center justify-between p-4 border-b border-border bg-card z-10">
              <div className="flex items-center gap-3">
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-md hover:bg-muted text-muted-foreground transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
                {ticket && (
                  <span className="font-mono text-sm font-semibold text-muted-foreground">
                    #{formatTicketNumber(ticket.ticketNumber)}
                  </span>
                )}
              </div>
              {ticket && (
                <Link
                  href={`/tickets/${ticket.id}`}
                  className="btn btn-secondary btn-sm"
                  title={t('ui.expandFullPage')}
                >
                  <ExternalLink className="w-4 h-4 mr-1.5 rtl:mr-0 rtl:ml-1.5" />
                  <span>{t('drawer.openFull')}</span>
                </Link>
              )}
            </div>

            {loading || !ticket ? (
              <div className="flex-1 flex items-center justify-center">
                <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4">
                
                {/* Ticket Header */}
                <div>
                  <div className="flex items-center gap-2 flex-wrap mb-3">
                    <span className="badge badge-category flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5" />
                      {getCategoryLabel(ticket.category, locale)}
                    </span>
                    <span className={priorityBadgeClass(ticket.priority as Priority)}>
                      {getPriorityLabel(ticket.priority, locale)}
                    </span>
                    <span className={statusBadgeClass(ticket.status as Status)}>
                      <span className="badge-dot" />
                      {getStatusLabel(ticket.status, locale)}
                    </span>
                  </div>
                  <h2 className="text-2xl font-bold text-foreground mb-4">
                    {ticket.title}
                  </h2>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <User className="w-4 h-4" />
                      {ticket.createdBy?.name}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-4 h-4" />
                      {formatRelativeTime(ticket.createdAt, locale)}
                    </span>
                  </div>
                </div>

                {/* Real Gemini summary on request (the drawer is only used by IT staff and admins) */}
                <AiTicketSummary ticketId={ticket.id} onInsert={(text) => setCommentText((prev) => (prev ? `${prev}\n\n${text}` : text))} />

                {/* Conversation & Audit History */}
                <div>
                  <h3 className="font-semibold text-base mb-4 flex items-center gap-2 text-foreground">
                    <MessageSquare className="w-4 h-4" />
                    {t('drawer.conversationThread')}
                  </h3>
                  
                  <div className="space-y-4">
                    {/* Original Description */}
                    <div className="flex gap-4">
                      <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center shrink-0 text-xs font-bold text-foreground">
                        {getInitials(ticket.createdBy?.name)}
                      </div>
                      <div className="flex-1 bg-muted/40 p-3.5 rounded-2xl rounded-tl-sm border border-border">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="font-medium text-sm text-foreground">{ticket.createdBy?.name}</span>
                          <span className="text-[10px] text-muted-foreground">{formatRelativeTime(ticket.createdAt, locale)}</span>
                        </div>
                        <p className="text-sm text-foreground whitespace-pre-wrap">{ticket.description}</p>
                        <AiTranslateButton text={ticket.description} />
                      </div>
                    </div>

                    {/* Comments */}
                    {ticket.comments?.map((comment) => {
                      const isIT = comment.author?.role !== 'EMPLOYEE'
                      return (
                        <div key={comment.id} className="flex gap-4">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
                            isIT ? 'bg-brand text-white' : 'bg-secondary text-foreground'
                          }`}>
                            {getInitials(comment.author?.name)}
                          </div>
                          <div className={`flex-1 p-3.5 rounded-2xl border ${
                            isIT 
                              ? 'bg-brand/5 border-brand/20 rounded-tl-sm' 
                              : 'bg-muted/40 border-border rounded-tr-sm'
                          }`}>
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="font-medium text-sm text-foreground">
                                {comment.author?.name}
                                {isIT && <span className="ml-2 text-[10px] uppercase font-bold text-brand bg-brand/10 px-1.5 py-0.5 rounded">{t('ui.itSupportBadge')}</span>}
                              </span>
                              <span className="text-[10px] text-muted-foreground">{formatRelativeTime(comment.createdAt, locale)}</span>
                            </div>
                            <p className="text-sm text-foreground whitespace-pre-wrap">{comment.content}</p>
                            <AiTranslateButton text={comment.content} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

              </div>
            )}

            {/* Bottom Action Bar */}
            {ticket && (
              <div className="shrink-0 p-3 border-t border-border bg-card/95 backdrop-blur-sm z-10">
                
                {canChangeTickets && ownedByPeer && !finished ? (
                   <div className="p-4 bg-orange-500/10 border-t border-orange-500/20 flex items-center justify-between">
                     <div className="flex items-center gap-3">
                       <AlertTriangle className="w-5 h-5 text-orange-600" />
                       <div>
                         <p className="font-semibold text-sm text-orange-800 dark:text-orange-300">
                           {t('drawer.lockedBy', { name: ticket.assignedTo?.name ?? '' })}
                         </p>
                         <p className="text-xs text-orange-700/80 dark:text-orange-400/80">
                           {t('drawer.takeOverToModifyStatus')}
                         </p>
                       </div>
                     </div>
                     <button
                       onClick={handleTakeOver}
                       disabled={isPending}
                       className="btn btn-sm bg-orange-600 hover:bg-orange-700 text-white border-0"
                     >
                       {isPending ? (t('drawer.takingOver')) : (t('drawer.takeOver'))}
                     </button>
                   </div>
                ) : (
                  <div className="p-4 flex flex-col gap-3">
                    {/* The admin's canned replies (Settings) */}
                    {cannedResponses.length > 0 && (
                      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
                        {cannedResponses.map((reply) => (
                          <button
                            key={reply.id}
                            type="button"
                            title={reply.content}
                            onClick={() => setCommentText(reply.content)}
                            className="px-3 py-1.5 rounded-full text-xs font-medium bg-muted text-muted-foreground hover:bg-secondary hover:text-foreground whitespace-nowrap transition-colors border border-border"
                          >
                            {reply.title}
                          </button>
                        ))}
                      </div>
                    )}

                    <form onSubmit={handleAddComment} className="flex gap-2 relative">
                      <input
                        type="text"
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        placeholder={t('drawer.typeAMessage')}
                        className="flex-1 bg-muted/50 border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:bg-background transition-all"
                      />
                      <button
                        type="submit"
                        disabled={isPending || !commentText.trim()}
                        className="btn btn-primary px-3 rounded-xl shrink-0"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    </form>

                    {canChangeTickets && !ownedByPeer && (
                    <div className="flex items-center gap-2 pt-2 border-t border-border">
                      {/* Contextual Status Transition */}
                      {(() => {
                        const nextStatuses = NEXT_STATUSES[ticket.status as Status] || []
                        if (nextStatuses.length === 0) return (
                          <div className="flex-1 text-center py-2 text-sm font-medium text-muted-foreground">
                            {t('drawer.ticketIsClosed')}
                          </div>
                        )

                        const nextStatus = nextStatuses[0]
                        let buttonText = "Update Status"
                        let buttonClass = "btn btn-primary w-full"
                        
                        if (ticket.status === 'OPEN') {
                          buttonText = t('drawer.claimAssignToMe')
                        } else if (ticket.status === 'ASSIGNED') {
                          buttonText = t('drawer.startProgress')
                        } else if (ticket.status === 'IN_PROGRESS') {
                          buttonText = t('drawer.markAsResolved')
                          buttonClass = "btn w-full bg-emerald-600 hover:bg-emerald-700 text-white border-0"
                        } else if (ticket.status === 'RESOLVED') {
                          buttonText = t('drawer.closeTicket')
                          buttonClass = "btn w-full bg-slate-700 hover:bg-slate-800 text-white border-0"
                        }

                        return (
                          <button
                            onClick={() => handleStatusTransition(nextStatus)}
                            disabled={isPending}
                            className={buttonClass}
                          >
                            {isPending ? (t('drawer.updating')) : buttonText}
                          </button>
                        )
                      })()}
                    </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  )
}


