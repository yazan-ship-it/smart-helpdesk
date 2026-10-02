'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import confetti from 'canvas-confetti'
import { toast } from 'sonner'
import {
 ArrowLeft,
 Clock,
 CheckCircle2,
 Send,
 Calendar,
 Shield,
 Activity,
 MessageSquare,
 Paperclip,
 ExternalLink,
 Copy,
 Check,
 UserCheck,
 RefreshCw,
 PlusCircle,
 FileText,
 Loader2,
  Lock,
  AlertCircle,
} from 'lucide-react'
import { updateTicketStatus, assignTicket, addComment, takeOverTicket, confirmTicketResolution, reopenTicket, submitCsatRating } from '@/app/actions/tickets'
import { formatRelativeTime, formatTicketNumber } from '@/lib/utils'
import { SlaBadge } from '@/components/SlaBadge'
import { useTranslation, getStatusLabel, getPriorityLabel, getCategoryLabel } from '@/lib/i18n'
import AiTranslateButton from '@/app/components/AiTranslateButton'
import AiTicketSummary from '@/app/components/AiTicketSummary'
import { describeHistory } from '@/lib/history'
import { getRoleLabel } from '@/lib/roles'
import { parseSkills } from '@/lib/skills'

type Status = 'OPEN' | 'ASSIGNED' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED'
type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
type Role = 'EMPLOYEE' | 'IT_SUPPORT' | 'ADMIN'

export type Attachment = {
 name: string
 size: number
 type: string
 url: string
}

 export type TicketDetailData = {
 id: string
 ticketNumber: number
 title: string
 description: string
 category: string
 priority: Priority
 status: Status
 attachments: string
 slaDeadline: string | null
 slaBreached: boolean | null
 csatRating: number | null
 csatFeedback: string | null
 resolvedAt: string | null
 closedAt: string | null
 createdAt: string
 updatedAt: string
 createdBy: { id: string; name: string; email: string }
 assignedTo: { id: string; name: string } | null
 assignedToId: string | null
 comments: Array<{
 id: string
 content: string
 isInternal: boolean
 createdAt: string
 author: { name: string; role: Role }
 }>
 ticketHistories: Array<{
 id: string
 action: string
 event: string | null
 meta: string | null
 createdAt: string
 user: { name: string }
 }>
}

type Props = {
 ticket: TicketDetailData
 itAgents: Array<{ id: string; name: string; skills: string; isAvailable: boolean }>
 cannedResponses: Array<{ id: string; title: string; content: string }>
 currentUserId: string
 currentUserRole: Role
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

// Valid next statuses for status machine display
const NEXT_STATUSES: Record<Status, Status[]> = {
 OPEN: ['ASSIGNED'],
 ASSIGNED: ['IN_PROGRESS'],
 IN_PROGRESS: ['RESOLVED'],
 RESOLVED: ['CLOSED'],
 CLOSED: [],
}

function priorityBadgeClass(p: Priority) {
 switch (p) {
 case 'LOW':
 return 'badge badge-low'
 case 'MEDIUM':
 return 'badge badge-medium'
 case 'HIGH':
 return 'badge badge-high'
 case 'CRITICAL':
 return 'badge badge-critical'
 }
}


function formatBytes(bytes: number) {
 if (bytes < 1024) return `${bytes} B`
 if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
 return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function getInitials(name: string) {
 if (!name) return 'U'
 const parts = name.trim().split(' ')
 if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
 return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export default function TicketDetailClient({
  ticket,
  itAgents,
  cannedResponses,
  currentUserId,
  currentUserRole,
}: Props) {
 const router = useRouter()
  const { t, locale } = useTranslation()
 const [commentText, setCommentText] = useState('')
 const [isInternalNote, setIsInternalNote] = useState(false)
 const [activeTab, setActiveTab] = useState<'all' | 'comments' | 'history'>('all')
 const [copied, setCopied] = useState(false)
 const [selectedAssignee, setSelectedAssignee] = useState(ticket.assignedToId ?? '')

 const [reopenReason, setReopenReason] = useState('')
 const [showReopenDialog, setShowReopenDialog] = useState(false)
 const [csatRatingValue, setCsatRatingValue] = useState(0)
 const [csatFeedbackText, setCsatFeedbackText] = useState('')
 const [isPendingAction, startTransitionAction] = useTransition()

 const [isPendingComment, startTransitionComment] = useTransition()
 const [isPendingStatus, startTransitionStatus] = useTransition()
 const [isPendingAssign, startTransitionAssign] = useTransition()
  const isAdmin = currentUserRole === 'ADMIN'
  const isITSupport = currentUserRole === 'IT_SUPPORT' || isAdmin
  const isAssignedToPeer = isITSupport && !isAdmin && Boolean(ticket.assignedToId) && ticket.assignedToId !== currentUserId
  const isUnassigned = isITSupport && !ticket.assignedToId

  const [isPendingTakeOver, startTransitionTakeOver] = useTransition()

  const handleTakeOver = () => {
    startTransitionTakeOver(async () => {
      try {
        const result = await takeOverTicket(ticket.id)
        if (result?.error) {
          toast.error(t(`errors.${result.error}`, result.params))
        } else {
          toast.success(
            ticket.assignedTo ? t('toasts.takenOverFrom', { name: ticket.assignedTo.name }) : t('toasts.claimed')
          )
          router.refresh()
        }
      } catch {
        toast.error(t('toasts.takeOverFailed'))
      }
    })
  }


 // Parse attachments
 let attachmentsList: Attachment[] = []
 try {
 attachmentsList = JSON.parse(ticket.attachments || '[]')
 } catch {
 attachmentsList = []
 }

 // Handle comment submit
 const handleCommentSubmit = (e: React.FormEvent) => {
 e.preventDefault()
 if (!commentText.trim()) return

 startTransitionComment(async () => {
 try {
 const result = await addComment(ticket.id, commentText, isInternalNote)
 if (result?.error) {
 toast.error(t(`errors.${result.error}`, result.params))
 } else {
 setCommentText('')
 setIsInternalNote(false)
 toast.success(isInternalNote ? t('toasts.internalNoteAdded') : t('toasts.commentPosted'))
 router.refresh()
 }
 } catch {
 toast.error(t('toasts.commentFailed'))
 }
 })
 }

 // Handle status update with celebratory confetti on 'RESOLVED'
 const handleStatusChange = (newStatus: Status) => {
 if (newStatus === ticket.status) return

 // Trigger celebratory confetti on resolution
 if (newStatus === 'RESOLVED') {
 try {
 confetti({
 particleCount: 110,
 spread: 70,
 origin: { y: 0.6 },
 colors: ['#6366f1', '#22c55e', '#a855f7', '#38bdf8', '#f59e0b'],
 })
 } catch {
 // Safe fallback
 }
 }

 startTransitionStatus(async () => {
 try {
 const result = await updateTicketStatus(ticket.id, newStatus)
 if (result?.error) {
 toast.error(t(`errors.${result.error}`, result.params))
 } else {
 toast.success(t('toasts.statusUpdatedTo', { status: getStatusLabel(newStatus, locale) }))
 router.refresh()
 }
 } catch {
 toast.error(t('toasts.statusFailed'))
 }
 })
 }

 // Handle assign ticket
 const handleAssignSubmit = (e: React.FormEvent) => {
 e.preventDefault()
 if (!selectedAssignee) return
 startTransitionAssign(async () => {
 try {
 const result = await assignTicket(ticket.id, selectedAssignee)
 if (result?.error) {
 toast.error(t(`errors.${result.error}`, result.params))
 } else {
 const agent = itAgents.find((a) => a.id === selectedAssignee)
 toast.success(t('toasts.assignedTo', { name: agent?.name ?? '' }))
 router.refresh()
 }
 } catch {
 toast.error(t('toasts.assignFailed'))
 }
 })
 }

 // Copy ticket link
 const handleCopyLink = () => {
 if (typeof window !== 'undefined') {
 navigator.clipboard.writeText(window.location.href)
 setCopied(true)
 toast.success(t('toasts.linkCopied'))
 setTimeout(() => setCopied(false), 2000)
 }
 }

 // Insert AI suggestion into comment box
 const handleInsertAiSuggestion = (suggestion: string) => {
 setCommentText((prev) => (prev ? `${prev}\n\n${suggestion}` : suggestion))
 toast.info(t('ai.insertedIntoReply'))
 }

 // Unified activity timeline list
 type TimelineItem =
 | { type: 'comment'; id: string; date: string; data: TicketDetailData['comments'][0] }
 | { type: 'history'; id: string; date: string; data: TicketDetailData['ticketHistories'][0] }

 const combinedTimeline: TimelineItem[] = [
 ...ticket.comments.map((c) => ({
 type: 'comment' as const,
 id: `c-${c.id}`,
 date: c.createdAt,
 data: c,
 })),
 ...ticket.ticketHistories.map((h) => ({
 type: 'history' as const,
 id: `h-${h.id}`,
 date: h.createdAt,
 data: h,
 })),
 ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

 const displayedTimeline = combinedTimeline.filter((item) => {
 if (activeTab === 'comments') return item.type === 'comment'
 if (activeTab === 'history') return item.type === 'history'
 return true
 })

 const isHighOrCritical = ticket.priority === 'CRITICAL' || ticket.priority === 'HIGH'

 return (
 <div className="animate-fade-up">
 {/* ───────────────────────────────────────────────────────────
 PAGE HEADER & BREADCRUMBS
 ─────────────────────────────────────────────────────────── */}
 <div className="page-header">
 <div className="flex items-center justify-between mb-3">
 <Link
 href="/tickets"
 className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
 >
 <ArrowLeft className="w-3.5 h-3.5" />
 <span>{t('tickets.backToAllTickets')}</span>
 </Link>

 <button
 onClick={handleCopyLink}
 className="btn btn-secondary btn-sm"
 title={t('ui.copyTicketUrl')}
 >
 {copied ? (
 <>
 <Check className="w-3.5 h-3.5 text-emerald-800 dark:text-emerald-300" />
 <span className="text-xs text-emerald-800 dark:text-emerald-300">{locale === 'ar' ? 'تم النسخ' : 'Copied URL'}</span>
 </>
 ) : (
 <>
 <Copy className="w-3.5 h-3.5 text-muted-foreground" />
 <span className="text-xs">{locale === 'ar' ? 'مشاركة الرابط' : 'Share Link'}</span>
 </>
 )}
 </button>
 </div>

 {/* Employee Interactive Banners & Stepper */}
 {currentUserRole === 'EMPLOYEE' && ticket.status === 'RESOLVED' && (
   <div className="mb-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm animate-fade-in">
     <div className="flex items-center gap-3 text-emerald-800 dark:text-emerald-300">
       <CheckCircle2 className="w-6 h-6 shrink-0" />
       <p className="font-semibold text-[15px]">{locale === 'ar' ? 'قام فريق الدعم الفني بحل المشكلة. هل تم الإصلاح بنجاح؟' : 'The IT team marked this issue as resolved. Does everything work properly?'}</p>
     </div>
     <div className="flex items-center gap-3 shrink-0 w-full md:w-auto">
       <button
         onClick={() => setShowReopenDialog(true)}
         disabled={isPendingAction}
         className="btn btn-secondary flex-1 md:flex-auto bg-card"
       >
         ↺ {locale === 'ar' ? 'المشكلة ما زالت مستمرة' : 'Issue Still Persists'}
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
         ✓ {locale === 'ar' ? 'تأكيد وإغلاق' : 'Confirm & Close'}
       </button>
     </div>
   </div>
 )}

 {showReopenDialog && (
   <div className="mb-6 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5 shadow-sm animate-fade-in space-y-3">
     <h3 className="font-semibold text-amber-800 dark:text-amber-300">{locale === 'ar' ? 'إعادة فتح التذكرة' : 'Reopen Ticket'}</h3>
     <textarea
       value={reopenReason}
       onChange={(e) => setReopenReason(e.target.value)}
       placeholder={locale === 'ar' ? 'يرجى توضيح سبب عدم حل المشكلة بالتفصيل...' : 'Please describe why this issue is not resolved...'}
       className="w-full p-3 rounded-xl border border-amber-500/30 bg-background text-sm focus:ring-2 focus:ring-amber-500/20 outline-none"
       rows={3}
     />
     <div className="flex justify-end gap-2">
       <button onClick={() => setShowReopenDialog(false)} className="btn btn-secondary text-sm">{locale === 'ar' ? 'إلغاء' : 'Cancel'}</button>
       <button
         onClick={() => {
           startTransitionAction(async () => {
             const res = await reopenTicket(ticket.id, reopenReason)
             if (res.error) toast.error(t(`errors.${res.error}`, res.params))
             else { toast.success(locale === 'ar' ? 'تم إعادة فتح التذكرة بنجاح' : 'Ticket reopened'); setShowReopenDialog(false); setReopenReason(''); router.refresh() }
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

 {currentUserRole === 'EMPLOYEE' && ticket.status === 'CLOSED' && ticket.csatRating === null && (
   <div className="mb-6 rounded-2xl border border-indigo-500/30 bg-indigo-500/10 p-5 shadow-sm animate-fade-in text-center space-y-4">
     <div>
       <h3 className="font-bold text-indigo-800 dark:text-indigo-300">{locale === 'ar' ? 'كيف كانت تجربتك؟' : 'How was your experience?'}</h3>
       <p className="text-sm text-indigo-700/80 dark:text-indigo-400/80">{locale === 'ar' ? 'يرجى تقييم الدعم الذي تلقيته لهذه التذكرة.' : 'Please rate the support you received for this ticket.'}</p>
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
           placeholder={locale === 'ar' ? 'ملاحظات إضافية (اختياري)...' : 'Optional feedback...'}
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

 {currentUserRole === 'EMPLOYEE' && (
   <div className="mb-10 px-2 sm:px-8 mt-4 animate-fade-in">
     <div className="flex items-center justify-between relative">
       {/* Background Track */}
       <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-border rounded-full" />
       
       {/* Active Track */}
       <div 
         className="absolute start-0 top-1/2 -translate-y-1/2 h-1 transition-all duration-500 rounded-full" 
         style={{ 
           width: ticket.status === 'OPEN' ? '0%' : 
                  ticket.status === 'ASSIGNED' ? '25%' : 
                  ticket.status === 'IN_PROGRESS' ? '50%' : 
                  ticket.status === 'RESOLVED' ? '75%' : '100%',
           background: 'var(--brand)'
         }} 
       />

       {[
         { id: 'OPEN', label: locale === 'ar' ? 'تم الإرسال' : 'Submitted' },
         { id: 'ASSIGNED', label: locale === 'ar' ? 'مسندة' : 'Assigned' },
         { id: 'IN_PROGRESS', label: locale === 'ar' ? 'قيد العمل' : 'In Progress' },
         { id: 'RESOLVED', label: locale === 'ar' ? 'تم الحل' : 'Resolved' },
         { id: 'CLOSED', label: locale === 'ar' ? 'مغلقة' : 'Closed' }
       ].map((step, idx) => {
         const statuses = ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];
         const currentIdx = statuses.indexOf(ticket.status);
         const isCompleted = idx < currentIdx;
         const isActive = idx === currentIdx;
         
         return (
           <div key={step.id} className="relative z-10 flex flex-col items-center gap-2">
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
               {isCompleted ? <Check className="w-4 h-4" /> : <div className={`w-2.5 h-2.5 rounded-full ${isActive ? 'animate-pulse' : 'bg-transparent'}`} style={isActive ? { background: 'var(--brand)'} : {}} />}
             </div>
             <span className={`text-[11px] font-semibold uppercase tracking-wider absolute top-10 whitespace-nowrap ${isActive ? 'text-foreground' : 'text-muted-foreground'}`}>
               {step.label}
             </span>
           </div>
         )
       })}
     </div>
   </div>
 )}

 {/* Title & Metadata Badges */}
 <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-3 border-b border-border">
 <div>
 <div className="flex items-center gap-2.5 mb-2 flex-wrap">
 <span className="text-xs font-mono font-medium px-2 py-0.5 rounded bg-muted text-foreground border border-border">
 #{formatTicketNumber(ticket.ticketNumber)}
 </span>
 <span className="badge badge-category">{getCategoryLabel(ticket.category, locale)}</span>
 <span className={priorityBadgeClass(ticket.priority)}>
 {isHighOrCritical && (
 <span className="relative flex h-2 w-2 mr-0.5">
 <span
 className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
 ticket.priority === 'CRITICAL' ? 'bg-red-400' : 'bg-orange-400'
 }`}
 />
 <span
 className={`relative inline-flex rounded-full h-2 w-2 ${
 ticket.priority === 'CRITICAL' ? 'bg-red-500' : 'bg-orange-500'
 }`}
 />
 </span>
 )}
 {getPriorityLabel(ticket.priority, locale)}
 </span>
 <span className={statusBadgeClass(ticket.status)}>
 <span className="badge-dot" />
 {getStatusLabel(ticket.status, locale)}
 </span>
 {ticket.slaDeadline && ticket.status !== 'CLOSED' && ticket.status !== 'RESOLVED' && (
   <SlaBadge deadline={ticket.slaDeadline} />
 )}
 {ticket.slaDeadline && (ticket.status === 'RESOLVED' || ticket.status === 'CLOSED') && (
   <span className={`badge ${ticket.slaBreached ? 'badge-critical' : 'badge-resolved'}`}>
     {ticket.slaBreached ? t('tickets.slaMissed') : t('tickets.slaMet')}
   </span>
 )}
 </div>

 <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
 {ticket.title}
 </h1>
 </div>

 <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0">
 <span className="flex items-center gap-1.5">
 <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
 {locale === 'ar' ? 'تم الإنشاء ' : 'Created '}{formatRelativeTime(ticket.createdAt, locale)}
 </span>
 <span>•</span>
 <span className="flex items-center gap-1.5">
 <Clock className="w-3.5 h-3.5 text-muted-foreground" />
 {locale === 'ar' ? 'آخر نشاط ' : 'Active '}{formatRelativeTime(ticket.updatedAt, locale)}
 </span>
 </div>
 </div>
 </div>

 {/* ───────────────────────────────────────────────────────────
 MAIN CONTENT (2 COLUMNS: LEFT WORKSPACE / RIGHT DETAILS)
 ─────────────────────────────────────────────────────────── */}
 <div className="page-content">
 <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
 {/* LEFT 2 COLUMNS: AI WIDGET + DESCRIPTION + TIMELINE */}
 <div className="lg:col-span-2 space-y-6">
 {isITSupport && <AiTicketSummary ticketId={ticket.id} onInsert={handleInsertAiSuggestion} />}

 {/* 2. TICKET DESCRIPTION CARD */}
 <div className="card p-6 border-border bg-card backdrop-blur-md">
 <div className="flex items-center justify-between gap-4 mb-4 pb-4 border-b border-border">
 <div className="flex items-center gap-3">
 <div
 className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold text-foreground shadow-inner"
 style={{
 background: 'linear-gradient(135deg, #a78bfa, #f472b6)',
 }}
 >
 {getInitials(ticket.createdBy.name)}
 </div>
 <div>
 <div className="flex items-center gap-2">
 <span className="text-sm font-semibold text-foreground">
 {ticket.createdBy.name}
 </span>
 <span className="text-[11px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border">{locale === 'ar' ? 'مقدم الطلب' : 'Requester'}</span>
 </div>
 <span className="text-xs text-muted-foreground">
 {ticket.createdBy.email}
 </span>
 </div>
 </div>
 <span className="text-xs text-muted-foreground">
 {new Date(ticket.createdAt).toLocaleTimeString([], {
 hour: '2-digit',
 minute: '2-digit',
 })}
 </span>
 </div>

 {/* Description Body */}
 <div className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
 {ticket.description}
 </div>
 <AiTranslateButton text={ticket.description} />

 {/* Attachments Section */}
 {attachmentsList.length > 0 && (
 <div className="mt-6 pt-5 border-t border-border">
 <div className="flex items-center gap-2 mb-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
 <Paperclip className="w-3.5 h-3.5 text-indigo-700 dark:text-indigo-400" />
 <span>{locale === 'ar' ? `المرفقات المرفوعة (${attachmentsList.length})` : `Uploaded Attachments (${attachmentsList.length})`}</span>
 </div>
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
 {attachmentsList.map((file, idx) => {
 const isImg = file.type?.startsWith('image/')
 return (
 <a
 key={idx}
 href={file.url}
 target="_blank"
 rel="noopener noreferrer"
 className="flex items-center gap-3 p-3 rounded-xl bg-background/[0.03] hover:bg-background/[0.07] border border-border hover:border-border transition-all group"
 >
 <div className="w-9 h-9 rounded-lg bg-muted border border-border flex items-center justify-center shrink-0 text-muted-foreground group-hover:text-indigo-700 dark:text-indigo-400 transition-colors overflow-hidden">
 {isImg ? (
 // eslint-disable-next-line @next/next/no-img-element -- tiny thumbnail of a user upload with unknown dimensions
 <img
 src={file.url}
 alt={file.name}
 className="w-full h-full object-cover"
 />
 ) : (
 <FileText className="w-4 h-4" />
 )}
 </div>
 <div className="min-w-0 flex-1">
 <p className="text-xs font-medium text-foreground truncate group-hover:text-foreground transition-colors">
 {file.name}
 </p>
 <p className="text-[11px] text-muted-foreground">
 {formatBytes(file.size)}
 </p>
 </div>
 <ExternalLink className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
 </a>
 )
 })}
 </div>
 </div>
 )}
 </div>

 {/* 3. INTERACTIVE CONNECTED ACTIVITY TIMELINE */}
 <div>
 <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
 <div className="flex items-center gap-2">
 <Activity className="w-4 h-4 text-indigo-700 dark:text-indigo-400" />
 <h2 className="text-sm font-semibold text-foreground">
 {locale === 'ar' ? 'السجل الزمني للمحادثة والنشاط' : 'Chronological Activity & Discussion'}
 </h2>
 <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-foreground border border-border">
 {locale === 'ar' ? `${ticket.comments.length} ردود` : `${ticket.comments.length} responses`}
 </span>
 </div>

 {/* Filter Tabs */}
 <div className="flex items-center gap-1 bg-card p-1 rounded-xl border border-border text-xs">
 <button
 onClick={() => setActiveTab('all')}
 className={`px-3 py-1 rounded-lg transition-colors font-medium cursor-pointer ${
 activeTab === 'all'
 ? 'bg-indigo-600 text-foreground shadow-sm'
 : 'text-muted-foreground hover:text-foreground'
 }`}
 >
 {locale === 'ar' ? 'كل الأنشطة' : 'All Activity'}
 </button>
 <button
 onClick={() => setActiveTab('comments')}
 className={`px-3 py-1 rounded-lg transition-colors font-medium cursor-pointer ${
 activeTab === 'comments'
 ? 'bg-indigo-600 text-foreground shadow-sm'
 : 'text-muted-foreground hover:text-foreground'
 }`}
 >
 {locale === 'ar' ? `التعليقات (${ticket.comments.length})` : `Comments (${ticket.comments.length})`}
 </button>
 <button
 onClick={() => setActiveTab('history')}
 className={`px-3 py-1 rounded-lg transition-colors font-medium cursor-pointer ${
 activeTab === 'history'
 ? 'bg-indigo-600 text-foreground shadow-sm'
 : 'text-muted-foreground hover:text-foreground'
 }`}
 >
 {locale === 'ar' ? `سجل التغييرات (${ticket.ticketHistories.length})` : `Audit Trail (${ticket.ticketHistories.length})`}
 </button>
 </div>
 </div>

 {/* Connected Vertical Timeline */}
 {displayedTimeline.length === 0 ? (
 <div className="card p-8 text-center border-dashed border-border bg-muted dark:bg-card/30">
 <MessageSquare className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
 <p className="text-sm font-medium text-foreground">
 {locale === 'ar' ? 'لا توجد أنشطة مسجلة بعد' : 'No activity recorded yet'}
 </p>
 <p className="text-xs text-muted-foreground mt-1">
 {locale === 'ar' ? 'أرسل أول ملاحظة تشخيصية أو تحديث حل أدناه.' : 'Submit the first diagnostic note or resolution update below.'}
 </p>
 </div>
 ) : (
 <div className="relative space-y-6 before:absolute before:left-4 before:-translate-x-1/2 before:top-3 before:bottom-3 before:w-0.5 before:bg-border">
 {displayedTimeline.map((item) => {
 if (item.type === 'comment') {
 const c = item.data
 const isSupport = c.author.role === 'IT_SUPPORT'

 return (
 <div key={item.id} className="relative group">
 {/* Left node dot centered on vertical line */}
 <div
  className={`absolute left-4 -translate-x-1/2 top-3 w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 z-10 ${isSupport ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}
>
 {getInitials(c.author.name)}
 </div>

 {/* Content Bubble cleanly padded outside icon bounding box */}
 <div className="pl-11 sm:pl-12">
 <div className={`rounded-xl border p-4 shadow-sm transition-colors ${c.isInternal ? 'bg-amber-500/5 border-amber-500/20 hover:border-amber-500/40' : 'bg-card border-border hover:border-border'}`}>
 <div className="flex items-center justify-between mb-2">
 <div className="flex items-center gap-2 flex-wrap">
 <span className="text-xs font-semibold text-foreground">
 {c.author.name}
 </span>
 <span
 className={`text-[10px] px-2 py-0.5 rounded font-medium ${
 isSupport
 ? 'bg-indigo-500/15 text-indigo-800 dark:text-indigo-300 border border-indigo-500/30'
 : 'bg-purple-500/15 text-purple-300 border border-purple-500/30'
 }`}
 >
 {isSupport ? (locale === 'ar' ? 'أخصائي الدعم الفني' : 'IT Support Agent') : (locale === 'ar' ? 'مقدم الطلب' : 'Requester')}
 </span>
 {c.isInternal && (
   <span className="text-[10px] px-2 py-0.5 rounded font-bold uppercase bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 flex items-center gap-1">
     <Lock className="w-2.5 h-2.5" />
     {locale === 'ar' ? 'ملاحظة خاصة' : 'Private Note'}
   </span>
 )}
 </div>
 <span className="text-xs text-muted-foreground">
 {formatRelativeTime(c.createdAt, locale)}
 </span>
 </div>

 <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
 {c.content}
 </p>
 <AiTranslateButton text={c.content} />
 </div>
 </div>
 </div>
 )
 } else {
 const h = item.data
 const isStatusAction = h.event === 'status_changed'
 const isAssignAction = ['assigned', 'auto_assigned', 'reassigned_by_admin', 'taken_over'].includes(h.event ?? '')

 return (
 <div key={item.id} className="relative group">
 {/* Left node icon centered on vertical line */}
 <div className="absolute left-4 -translate-x-1/2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-card dark:bg-card border border-border flex items-center justify-center text-muted-foreground shadow-sm shrink-0 z-10">
 {isStatusAction ? (
 <RefreshCw className="w-3.5 h-3.5 text-emerald-800 dark:text-emerald-300" />
 ) : isAssignAction ? (
 <UserCheck className="w-3.5 h-3.5 text-indigo-700 dark:text-indigo-400" />
 ) : (
 <PlusCircle className="w-3.5 h-3.5 text-purple-400" />
 )}
 </div>

 {/* Audit trail event text cleanly padded outside icon */}
 <div className="pl-11 sm:pl-12 py-1">
 <div className="text-xs text-foreground flex items-center gap-2 flex-wrap">
 <span className="font-semibold text-foreground">
 {h.user.name}
 </span>
 <span className="text-muted-foreground">
   {describeHistory(h, h.user.name, t, {
     status: (s) => getStatusLabel(s, locale),
     priority: (p) => getPriorityLabel(p, locale),
     category: (c) => getCategoryLabel(c, locale),
   })}
 </span>
 <span>•</span>
 <span className="text-muted-foreground">{formatRelativeTime(h.createdAt, locale)}</span>
 </div>
 </div>
 </div>
 )
 }
 })}
 </div>
 )}

 {/* Add Comment Input Form */}
 <div className="card p-5 mt-6 border-border bg-card backdrop-blur-md">
 <form onSubmit={handleCommentSubmit} className="space-y-3">
 <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-1">
 <span className="flex items-center gap-2 text-xs font-semibold text-foreground">
 <MessageSquare className="w-3.5 h-3.5 text-indigo-700 dark:text-indigo-400" />
 {locale === 'ar' ? 'إضافة رد أو تحديث...' : 'Add a response or update...'}
 </span>
 {isITSupport && (
   <label className="flex items-center gap-2 text-[11px] font-semibold text-amber-700 dark:text-amber-400 cursor-pointer select-none bg-amber-500/10 hover:bg-amber-500/20 px-2 py-1 rounded-md transition-colors border border-amber-500/20">
     <input type="checkbox" checked={isInternalNote} onChange={(e) => setIsInternalNote(e.target.checked)} className="rounded border-amber-500/30 text-amber-600 focus:ring-amber-500/30" />
     {locale === 'ar' ? '🔒 ملاحظة داخلية خاصة (لفريق الدعم فقط)' : '🔒 Private Internal Note (IT Only)'}
   </label>
 )}
 </div>

 {isITSupport && cannedResponses.length > 0 && (
   <div className="flex flex-wrap gap-1.5 pb-1">
     {cannedResponses.map((r) => (
       <button
         key={r.id}
         type="button"
         onClick={() => setCommentText(prev => prev ? `${prev}\n\n${r.content}` : r.content)}
         className="text-[10px] font-medium px-2 py-1 rounded-full border border-border bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors"
       >
         {r.title}
       </button>
     ))}
   </div>
 )}

 <textarea
 rows={3}
 value={commentText}
 onChange={(e) => setCommentText(e.target.value)}
 placeholder={isInternalNote 
    ? (locale === 'ar' ? 'اكتب ملاحظات فنية داخلية خاصة...' : 'Type private technical notes...') 
    : (locale === 'ar' ? 'اكتب ملاحظات التشخيص، أو الرد على مقدم الطلب، أو تفاصيل الحل…' : 'Type diagnostic notes, requester reply, or resolution details…')}
 className={`w-full rounded-xl p-3 text-sm outline-none transition-all focus:ring-2 resize-none ${isInternalNote ? 'bg-amber-500/5 border-amber-500/30 text-amber-900 dark:text-amber-100 placeholder:text-amber-700/50 focus:border-amber-500/60 focus:ring-amber-500/20 hover:border-amber-500/40' : 'bg-background dark:bg-background border border-border text-foreground dark:text-foreground placeholder:text-muted-foreground focus:border-indigo-500/60 focus:ring-indigo-500/20 hover:border-border'}`}
 disabled={isPendingComment}
 onKeyDown={(e) => {
 if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
 handleCommentSubmit(e)
 }
 }}
 />

 <div className="flex items-center justify-end">
 <button
 type="submit"
 disabled={isPendingComment || !commentText.trim()}
 className="btn btn-primary btn-sm"
 >
 {isPendingComment ? (
 <>
 <Loader2 className="w-3.5 h-3.5 animate-spin" />
 <span>{locale === 'ar' ? 'جاري الإرسال...' : 'Posting…'}</span>
 </>
 ) : (
 <>
 <Send className="w-3.5 h-3.5" />
 <span>{locale === 'ar' ? 'إرسال الرد' : 'Post Response'}</span>
 </>
 )}
 </button>
 </div>
 </form>
 </div>
 </div>
 </div>

 {/* ───────────────────────────────────────────────────────────
 RIGHT SIDEBAR: IT CONTROLS & TICKET PROPERTIES
 ─────────────────────────────────────────────────────────── */}
 <div className="space-y-5">
 {/* IT SUPPORT CONTROLS (HIGH-CONTRAST SEGMENTED STATUS PILLS & CONFETTI) */}
 {isITSupport && (
 <div className="card p-5 border-border bg-gradient-to-b from-indigo-50 dark:from-indigo-500/10 via-white dark:via-zinc-900/90 to-white dark:to-zinc-900/90 shadow-sm  space-y-5">
 <div className="flex items-center justify-between pb-3 border-b border-border">
 <div className="flex items-center gap-2">
 <Shield className="w-4 h-4 text-indigo-600 dark:text-indigo-700 dark:text-indigo-400" />
 <h3 className="text-sm font-semibold text-foreground">
 {locale === 'ar' ? 'إجراءات أخصائي الدعم' : 'IT Specialist Actions'}
 </h3>
 </div>
 <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-800 dark:text-indigo-300 font-semibold">
 {getRoleLabel(currentUserRole, locale)}
 </span>
 </div>

 {/* Peer Ticket Edit Lock Banner (Read-Only Guard) */}
          {isAssignedToPeer && (
            <div className="rounded-xl p-3.5 bg-amber-500/10 border border-amber-500/30 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span className="text-xs font-bold text-amber-800 dark:text-amber-300">
                    {locale === 'ar' ? `مسندة إلى ${ticket.assignedTo?.name || 'الأخصائي'} — للقراءة فقط` : `Assigned to ${ticket.assignedTo?.name || 'Specialist'} - Read Only`}
                  </span>
                </div>
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-800 dark:text-amber-300 font-bold border border-amber-500/30">
                  {locale === 'ar' ? 'مقفلة' : 'Locked'}
                </span>
              </div>
              <p className="text-[11px] text-amber-800/80 dark:text-amber-200/80 leading-relaxed">
                {locale === 'ar' ? `هذه التذكرة تحت مسؤولية ${ticket.assignedTo?.name || 'أخصائي آخر'}. تم تعطيل تعديل الحالة والإغلاق.` : `This ticket is owned by ${ticket.assignedTo?.name || 'another specialist'}. Status transitions and resolution controls are disabled.`}
              </p>
              <button
                type="button"
                onClick={handleTakeOver}
                disabled={isPendingTakeOver}
                className="w-full mt-1 px-3 py-2 rounded-xl text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isPendingTakeOver ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>{locale === 'ar' ? 'جاري استلام التذكرة...' : 'Taking Over Ticket…'}</span>
                  </>
                ) : (
                  <>
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>{locale === 'ar' ? 'استلام التذكرة / إسناد لي' : 'Take Over / Reassign to Me'}</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Unassigned Claim Banner */}
          {isUnassigned && (
            <div className="rounded-xl p-3.5 bg-blue-500/10 border border-blue-500/30 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-blue-800 dark:text-blue-300 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  {locale === 'ar' ? 'بلاغ غير مسند' : 'Unassigned Incident'}
                </span>
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-800 dark:text-blue-300 font-bold">
                  {locale === 'ar' ? 'قائمة مفتوحة' : 'Open Queue'}
                </span>
              </div>
              <button
                type="button"
                onClick={handleTakeOver}
                disabled={isPendingTakeOver}
                className="w-full py-2 px-3 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isPendingTakeOver ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <UserCheck className="w-3.5 h-3.5" />
                )}
                <span>{locale === 'ar' ? 'استلام التذكرة (إسناد لي)' : 'Claim Ticket (Assign to Me)'}</span>
              </button>
            </div>
          )}

          {/* Status Machine: only show valid next transitions */}
 <div>
 <label className="block text-xs font-semibold text-foreground mb-2">
 {locale === 'ar' ? 'تغيير الحالة السريع' : 'Quick Status Change'}
 </label>
 <div className="mb-2 flex items-center gap-1.5">
 <span className="text-[11px] text-muted-foreground">{locale === 'ar' ? 'الحالية:' : 'Current:'}</span>
 <span className={statusBadgeClass(ticket.status as Status)}>
 <span className="badge-dot" />
 {getStatusLabel(ticket.status, locale)}
 </span>
 </div>
 {NEXT_STATUSES[ticket.status as Status]?.length === 0 ? (
 <p className="text-xs text-muted-foreground italic py-2">{locale === 'ar' ? 'هذه التذكرة في حالة نهائية (مغلقة).' : 'This ticket is in a terminal state (Closed).'}</p>
 ) : (
 <div className="flex flex-col gap-2">
 {NEXT_STATUSES[ticket.status as Status]?.map((nextStatus) => {
 const statusConfig: Record<Status, { label: string; cls: string; icon: React.ReactNode }> = {
 OPEN: { label: locale === 'ar' ? 'استلام وإسناد لي' : 'Claim & Assign to Me', cls: 'bg-amber-500/20 text-amber-600 dark:text-amber-300 border-amber-500/40', icon: <Clock className="w-3.5 h-3.5" /> },
 ASSIGNED: { label: locale === 'ar' ? 'بدء العمل' : 'Start Progress', cls: 'bg-violet-500/20 text-violet-600 dark:text-violet-300 border-violet-500/40', icon: <UserCheck className="w-3.5 h-3.5" /> },
 IN_PROGRESS: { label: locale === 'ar' ? 'بدء العمل' : 'Start Progress', cls: 'bg-blue-500/20 text-blue-300 border-blue-500/40', icon: <Activity className="w-3.5 h-3.5" /> },
 RESOLVED: { label: locale === 'ar' ? 'تعيين كمنجزة 🎉' : 'Mark Resolved 🎉', cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-500/40', icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
 CLOSED: { label: locale === 'ar' ? 'إغلاق التذكرة' : 'Close Ticket', cls: 'bg-muted text-foreground border-border', icon: null },
 }
 const cfg = statusConfig[nextStatus]
 return (
 <button
 key={nextStatus}
 type="button"
 disabled={isPendingStatus || isAssignedToPeer}
 onClick={() => !isAssignedToPeer && handleStatusChange(nextStatus)}
                      title={isAssignedToPeer ? `Assigned to ${ticket.assignedTo?.name || "specialist"} — Take over to modify status` : undefined}
 className={`w-full px-3 py-2 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 border ${cfg.cls} ${
                        isAssignedToPeer
                          ? 'opacity-40 cursor-not-allowed filter grayscale-[40%]'
                          : 'hover:opacity-90 cursor-pointer'
                      }`}
 >
 {cfg.icon}
 <span>{cfg.label}</span>
                      {isAssignedToPeer && <Lock className="w-3 h-3 ml-auto opacity-70" />}
 </button>
 )
 })}
 </div>
 )}
 </div>

   {/* Assign / Reassign Specialist Panel */}
  <form onSubmit={handleAssignSubmit} className="space-y-3 pt-2 border-t border-border">
  <div className="flex items-center justify-between">
  <label className="block text-xs font-semibold text-foreground">
  {ticket.assignedTo ? (locale === 'ar' ? 'إعادة إسناد الأخصائي' : 'Reassign Specialist') : (locale === 'ar' ? 'إسناد لأخصائي دعم' : 'Assign Support Specialist')}
  </label>
  {ticket.assignedTo && (
  <span className="text-[10px] text-muted-foreground italic">{locale === 'ar' ? `الحالي: ${ticket.assignedTo.name}` : `Current: ${ticket.assignedTo.name}`}</span>
  )}
  </div>
  {/* Agent Cards */}
  <div className="space-y-1.5">
  {itAgents.map((agent) => {
  const agentSkills = parseSkills(agent.skills)
  const isSelected = selectedAssignee === agent.id
  const isCurrent = ticket.assignedToId === agent.id
  return (
  <button
  key={agent.id}
  type="button"
  onClick={() => setSelectedAssignee(agent.id)}
  disabled={isPendingAssign}
  className={`w-full flex items-center gap-3 p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
  isSelected
  ? 'border-indigo-500/50 bg-indigo-500/10 ring-1 ring-indigo-500/20'
  : 'border-border hover:border-border hover:bg-muted/50'
  }`}
  >
  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 ${agent.isAvailable ? 'bg-indigo-500' : 'bg-muted-foreground/50'}`}>
  {getInitials(agent.name)}
  </div>
  <div className="flex-1 min-w-0">
  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
  <span className="text-xs font-semibold text-foreground truncate">{agent.name}</span>
  {isCurrent && <span className="text-[9px] font-bold uppercase px-1 py-0.5 rounded bg-violet-500/15 text-violet-700 dark:text-violet-300 border border-violet-500/20">{locale === 'ar' ? 'الحالي' : 'Current'}</span>}
  <span className={`text-[9px] font-bold uppercase px-1 py-0.5 rounded border ${agent.isAvailable ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20' : 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20'}`}>
  {agent.isAvailable ? (locale === 'ar' ? 'متاح' : 'Available') : (locale === 'ar' ? 'غير متواجد' : 'Away')}
  </span>
  </div>
  {agentSkills.length > 0 && (
  <div className="flex flex-wrap gap-1">
  {agentSkills.slice(0, 3).map((skill) => (
  <span key={skill} className={`text-[9px] px-1 py-0.5 rounded bg-muted text-muted-foreground border border-border ${skill === ticket.category ? 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/20 font-semibold' : ''}`}>
  {getCategoryLabel(skill, locale)}
  </span>
  ))}
  </div>
  )}
  </div>
  {isSelected && <UserCheck className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />}
  </button>
  )
  })}
  </div>
  <button
  type="submit"
  disabled={
  isPendingAssign ||
  !selectedAssignee ||
  selectedAssignee === ticket.assignedToId
  }
  className="btn btn-primary btn-sm w-full"
  >
  {isPendingAssign ? (
  <Loader2 className="w-3.5 h-3.5 animate-spin" />
  ) : (
  <UserCheck className="w-3.5 h-3.5" />
  )}
  <span>{ticket.assignedTo ? (locale === 'ar' ? 'إعادة إسناد التذكرة' : 'Reassign Ticket') : (locale === 'ar' ? 'إسناد التذكرة' : 'Assign Ticket')}</span>
  </button>
  </form>
 </div>
 )}

 {/* TICKET PROPERTIES METADATA CARD */}
 <div className="card p-5 border-border bg-card backdrop-blur-md space-y-4">
 <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
 {locale === 'ar' ? 'بيانات التذكرة' : 'Ticket Details'}
 </h3>

 <div className="space-y-3 text-xs">
 <div className="flex items-center justify-between py-1.5 border-b border-border">
 <span className="text-muted-foreground">{locale === 'ar' ? 'الحالة الحالية' : 'Current Status'}</span>
 <span className={statusBadgeClass(ticket.status)}>
 <span className="badge-dot" />
 {getStatusLabel(ticket.status, locale)}
 </span>
 </div>

 <div className="flex items-center justify-between py-1.5 border-b border-border">
 <span className="text-muted-foreground">{locale === 'ar' ? 'الأولوية' : 'Severity'}</span>
 <span className={priorityBadgeClass(ticket.priority)}>
 {getPriorityLabel(ticket.priority, locale)}
 </span>
 </div>

 <div className="flex items-center justify-between py-1.5 border-b border-border">
 <span className="text-muted-foreground">{locale === 'ar' ? 'التصنيف' : 'Category'}</span>
 <span className="badge badge-category">{getCategoryLabel(ticket.category, locale)}</span>
 </div>

 <div className="flex items-center justify-between py-1.5 border-b border-border">
 <span className="text-muted-foreground">{locale === 'ar' ? 'مقدم الطلب' : 'Submitted By'}</span>
 <span className="font-semibold text-foreground">
 {ticket.createdBy.name}
 </span>
 </div>

 <div className="flex items-center justify-between py-1.5 border-b border-border">
 <span className="text-muted-foreground">{locale === 'ar' ? 'الوكيل المسند' : 'Assigned Specialist'}</span>
 <span className="font-medium text-foreground">
 {ticket.assignedTo ? (
 <span className="inline-flex items-center gap-1.5 text-indigo-800 dark:text-indigo-300 font-semibold">
 <span className="w-2 h-2 rounded-full bg-indigo-400" />
 {ticket.assignedTo.name}
 </span>
 ) : (
 <span className="text-muted-foreground italic">{locale === 'ar' ? 'غير مسند' : 'Unassigned'}</span>
 )}
 </span>
 </div>

 <div className="flex items-center justify-between py-1.5 border-b border-border">
 <span className="text-muted-foreground">{locale === 'ar' ? 'تاريخ الإنشاء' : 'Created At'}</span>
 <span className="text-foreground">
 {formatRelativeTime(ticket.createdAt, locale)}
 </span>
 </div>

 <div className="flex items-center justify-between py-1.5">
 <span className="text-muted-foreground">{locale === 'ar' ? 'آخر تحديث' : 'Last Updated'}</span>
 <span className="text-foreground">
 {formatRelativeTime(ticket.updatedAt, locale)}
 </span>
 </div>
 </div>
 </div>
 </div>
 </div>
 </div>
 </div>
 )
}

