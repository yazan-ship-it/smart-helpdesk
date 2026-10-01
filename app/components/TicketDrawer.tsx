'use client'

import { useState, useEffect, useTransition, useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ExternalLink, MessageSquare, Clock, User, AlertTriangle, CheckCircle2, ChevronRight, Send, AlertCircle, RefreshCw, Zap, Sparkles, Layers } from 'lucide-react'
import { formatRelativeTime } from '@/lib/utils'
import Link from 'next/link'
import { toast } from 'sonner'
import { getTicketDetails, updateTicketStatus, addComment, takeOverTicket } from '@/app/actions/tickets'
import confetti from 'canvas-confetti'
import { useTranslation, getStatusLabel, getPriorityLabel, getCategoryLabel } from '@/lib/i18n'
import AiTranslateButton from '@/app/components/AiTranslateButton'

type Status = 'OPEN' | 'ASSIGNED' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED'
type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

const VALID_TRANSITIONS: Record<Status, Status[]> = {
  OPEN: ['ASSIGNED'],
  ASSIGNED: ['IN_PROGRESS'],
  IN_PROGRESS: ['RESOLVED'],
  RESOLVED: ['CLOSED'],
  CLOSED: [],
}

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
}: {
  ticketId: string | null
  isOpen: boolean
  onClose: () => void
  currentUserId: string
}) {
  const { t, locale, isRTL } = useTranslation()
  const [ticket, setTicket] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [commentText, setCommentText] = useState('')
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (ticket?.id) {
      scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'instant' })
    }
  }, [ticket?.id])

  useEffect(() => {
    if (isOpen && ticketId) {
      setLoading(true)
      getTicketDetails(ticketId).then((data) => {
        if (!data) {
          toast.error(locale === 'ar' ? 'تعذر العثور على التذكرة أو ليس لديك صلاحية' : 'Ticket not found or unauthorized')
          setLoading(false)
          onClose()
          return
        }
        setTicket(data)
        setLoading(false)
      }).catch((err) => {
        toast.error(locale === 'ar' ? 'فشل تحميل تفاصيل التذكرة' : 'Failed to load ticket details')
        setLoading(false)
      })
    }
  }, [isOpen, ticketId])

  const handleStatusTransition = async (nextStatus: Status) => {
    if (!ticket) return
    startTransition(async () => {
      try {
        await updateTicketStatus(ticket.id, nextStatus)
        toast.success(locale === 'ar' ? `تم تحديث حالة التذكرة إلى ${getStatusLabel(nextStatus, locale)}` : `Ticket marked as ${nextStatus}`)
        if (nextStatus === 'RESOLVED') {
          confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } })
        }
        const updated = await getTicketDetails(ticket.id)
        setTicket(updated)
      } catch (err: any) {
        toast.error(err.message || (locale === 'ar' ? 'فشل تحديث الحالة' : 'Failed to update status'))
      }
    })
  }

  const handleTakeOver = async () => {
    if (!ticket) return
    startTransition(async () => {
      try {
        await takeOverTicket(ticket.id)
        toast.success(locale === 'ar' ? 'لقد استلمت هذه التذكرة بنجاح.' : 'You have taken over this ticket.')
        const updated = await getTicketDetails(ticket.id)
        setTicket(updated)
      } catch (err: any) {
        toast.error(err.message || (locale === 'ar' ? 'فشل استلام التذكرة' : 'Failed to take over ticket'))
      }
    })
  }

  const handleAddComment = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!commentText.trim() || !ticket) return

    startTransition(async () => {
      try {
        await addComment(ticket.id, commentText)
        toast.success(locale === 'ar' ? 'تمت إضافة التعليق بنجاح' : 'Comment added')
        setCommentText('')
        const updated = await getTicketDetails(ticket.id)
        setTicket(updated)
      } catch (err: any) {
        toast.error(err.message || (locale === 'ar' ? 'فشل إضافة التعليق' : 'Failed to add comment'))
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
                    #TICK-{(ticket.ticketNumber || 0).toString().padStart(3, '0')}
                  </span>
                )}
              </div>
              {ticket && (
                <Link
                  href={`/tickets/${ticket.id}`}
                  className="btn btn-secondary btn-sm"
                  title="Expand to Full Page"
                >
                  <ExternalLink className="w-4 h-4 mr-1.5 rtl:mr-0 rtl:ml-1.5" />
                  <span>{locale === 'ar' ? 'عرض الصفحة كاملة' : 'Open Full'}</span>
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
                    <span className={priorityBadgeClass(ticket.priority)}>
                      {getPriorityLabel(ticket.priority, locale)}
                    </span>
                    <span className={statusBadgeClass(ticket.status)}>
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

                {/* AI Triage Card */}
                {true && (
                  <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/5 p-4 relative overflow-hidden">
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles className="w-4 h-4 text-indigo-500" />
                      <span className="text-xs font-bold text-foreground tracking-wide block uppercase">
                        {locale === 'ar' ? 'ملخص التشخيص الذكي' : 'AI Diagnostic Summary'}
                      </span>
                    </div>
                    <p className="text-sm text-foreground/80 leading-relaxed mb-3">
                      {locale === 'ar' ? `تصنيف آلي للبلاغ في فئة ${getCategoryLabel(ticket.category, locale)}. يُوصى بمراجعة السجلات وصلاحيات المستخدم قبل التصعيد.` : `Automated semantic incident classification for ${ticket.category}. Suggest reviewing logs and affected user permissions before escalating.`}
                    </p>
                    
                  </div>
                )}

                {/* Conversation & Audit History */}
                <div>
                  <h3 className="font-semibold text-base mb-4 flex items-center gap-2 text-foreground">
                    <MessageSquare className="w-4 h-4" />
                    {locale === 'ar' ? 'سلسلة المحادثة' : 'Conversation Thread'}
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
                    {ticket.comments?.map((comment: any) => {
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
                                {isIT && <span className="ml-2 text-[10px] uppercase font-bold text-brand bg-brand/10 px-1.5 py-0.5 rounded">IT Support</span>}
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
                
                {ticket.assignedToId && ticket.assignedToId !== currentUserId ? (
                   <div className="p-4 bg-orange-500/10 border-t border-orange-500/20 flex items-center justify-between">
                     <div className="flex items-center gap-3">
                       <AlertTriangle className="w-5 h-5 text-orange-600" />
                       <div>
                         <p className="font-semibold text-sm text-orange-800 dark:text-orange-300">
                           {locale === 'ar' ? `قيد المتابعة بواسطة ${ticket.assignedTo?.name}` : `Locked by ${ticket.assignedTo?.name}`}
                         </p>
                         <p className="text-xs text-orange-700/80 dark:text-orange-400/80">
                           {locale === 'ar' ? 'استلم التذكرة لتعديل الحالة أو الرد.' : 'Take over to modify status or reply.'}
                         </p>
                       </div>
                     </div>
                     <button
                       onClick={handleTakeOver}
                       disabled={isPending}
                       className="btn btn-sm bg-orange-600 hover:bg-orange-700 text-white border-0"
                     >
                       {isPending ? (locale === 'ar' ? 'جاري الاستلام...' : 'Taking over...') : (locale === 'ar' ? 'استلام التذكرة' : 'Take Over')}
                     </button>
                   </div>
                ) : (
                  <div className="p-4 flex flex-col gap-3">
                    {/* Quick Canned Response Chips */}
                    <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
                      {[
                        { en: "Password reset credentials sent.", ar: "تم إرسال بيانات تعيين كلمة المرور." },
                        { en: "Please provide device hostname/Asset ID.", ar: "يرجى تزويدنا باسم الجهاز أو معرّف الأصل (Asset ID)." },
                        { en: "Issue resolved on network switch. Please verify.", ar: "تم حل المشكلة على مقسم الشبكة. يرجى التحقق." }
                      ].map((chip) => (
                        <button
                          key={chip.en}
                          onClick={() => setCommentText(locale === 'ar' ? chip.ar : chip.en)}
                          className="px-3 py-1.5 rounded-full text-xs font-medium bg-muted text-muted-foreground hover:bg-secondary hover:text-foreground whitespace-nowrap transition-colors border border-border"
                        >
                          {locale === 'ar' ? chip.ar : chip.en}
                        </button>
                      ))}
                    </div>

                    <form onSubmit={handleAddComment} className="flex gap-2 relative">
                      <input
                        type="text"
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        placeholder={locale === 'ar' ? 'اكتب رسالة...' : 'Type a message...'}
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

                    <div className="flex items-center gap-2 pt-2 border-t border-border">
                      {/* Contextual Status Transition */}
                      {(() => {
                        const nextStatuses = VALID_TRANSITIONS[ticket.status as Status] || []
                        if (nextStatuses.length === 0) return (
                          <div className="flex-1 text-center py-2 text-sm font-medium text-muted-foreground">
                            {locale === 'ar' ? 'التذكرة مغلقة' : 'Ticket is Closed'}
                          </div>
                        )

                        const nextStatus = nextStatuses[0]
                        let buttonText = "Update Status"
                        let buttonClass = "btn btn-primary w-full"
                        
                        if (ticket.status === 'OPEN') {
                          buttonText = locale === 'ar' ? 'استلام وإسناد لي' : 'Claim & Assign to Me'
                        } else if (ticket.status === 'ASSIGNED') {
                          buttonText = locale === 'ar' ? 'بدء العمل' : 'Start Progress'
                        } else if (ticket.status === 'IN_PROGRESS') {
                          buttonText = locale === 'ar' ? 'تعيين كمنجزة' : 'Mark as Resolved'
                          buttonClass = "btn w-full bg-emerald-600 hover:bg-emerald-700 text-white border-0"
                        } else if (ticket.status === 'RESOLVED') {
                          buttonText = locale === 'ar' ? 'إغلاق التذكرة' : 'Close Ticket'
                          buttonClass = "btn w-full bg-slate-700 hover:bg-slate-800 text-white border-0"
                        }

                        return (
                          <button
                            onClick={() => handleStatusTransition(nextStatus)}
                            disabled={isPending}
                            className={buttonClass}
                          >
                            {isPending ? (locale === 'ar' ? 'جاري التحديث...' : 'Updating...') : buttonText}
                          </button>
                        )
                      })()}
                    </div>
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


