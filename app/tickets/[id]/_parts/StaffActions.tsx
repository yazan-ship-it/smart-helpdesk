'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import confetti from 'canvas-confetti'
import { toast } from 'sonner'
import { Activity, AlertCircle, CheckCircle2, Clock, Loader2, Lock, Shield, UserCheck } from 'lucide-react'
import { assignTicket, reassignTicket, takeOverTicket, updateTicketStatus } from '@/app/actions/tickets'
import { NEXT_STATUSES, type Status } from '@/lib/ticket-status'
import { getRoleLabel } from '@/lib/roles'
import { parseSkills } from '@/lib/skills'
import { useTranslation, getStatusLabel, getCategoryLabel } from '@/lib/i18n'
import { getInitials, statusBadgeClass, type AgentOption, type Role, type TicketDetailData } from './shared'

/**
 * The staff panel. IT support claims or takes over tickets and moves them
 * through their statuses; IT support and admins (re)assign them.
 */
export default function StaffActions({
  ticket,
  itAgents,
  currentUserId,
  currentUserRole,
}: {
  ticket: TicketDetailData
  itAgents: AgentOption[]
  currentUserId: string
  currentUserRole: Role
}) {
  const router = useRouter()
  const { t, locale } = useTranslation()
  const [selectedAssignee, setSelectedAssignee] = useState(ticket.assignedToId ?? '')
  const [isPendingTakeOver, startTakeOver] = useTransition()
  const [isPendingStatus, startStatus] = useTransition()
  const [isPendingAssign, startAssign] = useTransition()

  const isAdmin = currentUserRole === 'ADMIN'
  const isAssignedToPeer = !isAdmin && Boolean(ticket.assignedToId) && ticket.assignedToId !== currentUserId
  const isUnassigned = !ticket.assignedToId
  // Only IT support moves tickets through their statuses or claims them; admins oversee and reassign
  const canChangeStatus = currentUserRole === 'IT_SUPPORT'
  // Resolved and closed tickets can't be claimed or reassigned (the server refuses)
  const isFinished = ticket.status === 'RESOLVED' || ticket.status === 'CLOSED'
  const nextStatuses = NEXT_STATUSES[ticket.status]

  // Report a server action's result: its error, or the success message and a refresh
  const report = (result: { error?: string; params?: Record<string, string | number> } | undefined, success: string) => {
    if (result?.error) toast.error(t(`errors.${result.error}`, result.params))
    else {
      toast.success(success)
      router.refresh()
    }
  }

  const handleTakeOver = () => {
    startTakeOver(async () => {
      try {
        report(
          await takeOverTicket(ticket.id),
          ticket.assignedTo ? t('toasts.takenOverFrom', { name: ticket.assignedTo.name }) : t('toasts.claimed'),
        )
      } catch {
        toast.error(t('toasts.takeOverFailed'))
      }
    })
  }

  const handleStatusChange = (newStatus: Status) => {
    if (newStatus === ticket.status) return
    if (newStatus === 'RESOLVED') {
      try {
        confetti({ particleCount: 110, spread: 70, origin: { y: 0.6 }, colors: ['#6366f1', '#22c55e', '#a855f7', '#38bdf8', '#f59e0b'] })
      } catch {
        // Decoration only
      }
    }
    startStatus(async () => {
      try {
        report(await updateTicketStatus(ticket.id, newStatus), t('toasts.statusUpdatedTo', { status: getStatusLabel(newStatus, locale) }))
      } catch {
        toast.error(t('toasts.statusFailed'))
      }
    })
  }

  const handleAssignSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedAssignee) return
    startAssign(async () => {
      try {
        const agent = itAgents.find((a) => a.id === selectedAssignee)
        report(await (isAdmin ? reassignTicket : assignTicket)(ticket.id, selectedAssignee), t('toasts.assignedTo', { name: agent?.name ?? '' }))
      } catch {
        toast.error(t('toasts.assignFailed'))
      }
    })
  }

  const statusConfig: Record<Status, { label: string; cls: string; icon: React.ReactNode }> = {
    OPEN: { label: t('ticketPage.claimAssignToMe'), cls: 'bg-amber-500/20 text-amber-600 dark:text-amber-300 border-amber-500/40', icon: <Clock className="w-3.5 h-3.5" /> },
    ASSIGNED: { label: t('ticketPage.claimAssignToMe'), cls: 'bg-violet-500/20 text-violet-600 dark:text-violet-300 border-violet-500/40', icon: <UserCheck className="w-3.5 h-3.5" /> },
    IN_PROGRESS: { label: t('ticketPage.startProgress'), cls: 'bg-blue-500/20 text-blue-300 border-blue-500/40', icon: <Activity className="w-3.5 h-3.5" /> },
    RESOLVED: { label: t('ticketPage.markResolved'), cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-500/40', icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
    CLOSED: { label: t('ticketPage.closeTicket'), cls: 'bg-muted text-foreground border-border', icon: null },
  }

  return (
    <div className="card p-5 border-border bg-gradient-to-b from-indigo-50 dark:from-indigo-500/10 via-white dark:via-zinc-900/90 to-white dark:to-zinc-900/90 shadow-sm  space-y-5">
      <div className="flex items-center justify-between pb-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-indigo-600 dark:text-indigo-700 dark:text-indigo-400" />
          <h3 className="text-sm font-semibold text-foreground">
            {t('ticketPage.itSpecialistActions')}
          </h3>
        </div>
        <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-800 dark:text-indigo-300 font-semibold">
          {getRoleLabel(currentUserRole, locale)}
        </span>
      </div>

      {/* Another agent's ticket: read-only until taken over */}
      {isAssignedToPeer && !isFinished && (
        <div className="rounded-xl p-3.5 bg-amber-500/10 border border-amber-500/30 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <span className="text-xs font-bold text-amber-800 dark:text-amber-300">
                {t('ticketPage.assignedToReadOnly', { name: ticket.assignedTo?.name || t('ticketPage.theSpecialist') })}
              </span>
            </div>
            <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-800 dark:text-amber-300 font-bold border border-amber-500/30">
              {t('ticketPage.locked')}
            </span>
          </div>
          <p className="text-[11px] text-amber-800/80 dark:text-amber-200/80 leading-relaxed">
            {t('ticketPage.ownedByPeer', { name: ticket.assignedTo?.name || t('ticketPage.anotherSpecialist') })}
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
                <span>{t('ticketPage.takingOverTicket')}</span>
              </>
            ) : (
              <>
                <UserCheck className="w-3.5 h-3.5" />
                <span>{t('ticketPage.takeOverReassignToMe')}</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Unassigned: claim it */}
      {isUnassigned && canChangeStatus && !isFinished && (
        <div className="rounded-xl p-3.5 bg-blue-500/10 border border-blue-500/30 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-blue-800 dark:text-blue-300 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              {t('ticketPage.unassignedIncident')}
            </span>
            <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-800 dark:text-blue-300 font-bold">
              {t('ticketPage.openQueue')}
            </span>
          </div>
          <button
            type="button"
            onClick={handleTakeOver}
            disabled={isPendingTakeOver}
            className="w-full py-2 px-3 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isPendingTakeOver ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserCheck className="w-3.5 h-3.5" />}
            <span>{t('ticketPage.claimTicketAssignToMe')}</span>
          </button>
        </div>
      )}

      {/* Status machine: only the valid next step */}
      {canChangeStatus && (
        <div>
          <label className="block text-xs font-semibold text-foreground mb-2">
            {t('ticketPage.quickStatusChange')}
          </label>
          <div className="mb-2 flex items-center gap-1.5">
            <span className="text-[11px] text-muted-foreground">{t('ticketPage.current')}</span>
            <span className={statusBadgeClass(ticket.status)}>
              <span className="badge-dot" />
              {getStatusLabel(ticket.status, locale)}
            </span>
          </div>
          {nextStatuses.length === 0 ? (
            <p className="text-xs text-muted-foreground italic py-2">{t('ticketPage.thisTicketIsInA')}</p>
          ) : (
            <div className="flex flex-col gap-2">
              {nextStatuses.map((nextStatus) => {
                const cfg = statusConfig[nextStatus]
                return (
                  <button
                    key={nextStatus}
                    type="button"
                    disabled={isPendingStatus || isAssignedToPeer}
                    onClick={() => !isAssignedToPeer && handleStatusChange(nextStatus)}
                    title={isAssignedToPeer ? t('ticketPage.assignedToReadOnly', { name: ticket.assignedTo?.name || t('ticketPage.theSpecialist') }) : undefined}
                    className={`w-full px-3 py-2 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 border ${cfg.cls} ${
                      isAssignedToPeer ? 'opacity-40 cursor-not-allowed filter grayscale-[40%]' : 'hover:opacity-90 cursor-pointer'
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
      )}

      {/* Assign / reassign */}
      {!isFinished && (
        <form onSubmit={handleAssignSubmit} className="space-y-3 pt-2 border-t border-border">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-semibold text-foreground">
              {ticket.assignedTo ? t('ticketPage.reassignSpecialist') : t('ticketPage.assignSupportSpecialist')}
            </label>
            {ticket.assignedTo && (
              <span className="text-[10px] text-muted-foreground italic">{t('ticketPage.current2', { name: ticket.assignedTo.name })}</span>
            )}
          </div>
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
                      {isCurrent && <span className="text-[9px] font-bold uppercase px-1 py-0.5 rounded bg-violet-500/15 text-violet-700 dark:text-violet-300 border border-violet-500/20">{t('ticketPage.current3')}</span>}
                      <span className={`text-[9px] font-bold uppercase px-1 py-0.5 rounded border ${agent.isAvailable ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20' : 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20'}`}>
                        {agent.isAvailable ? t('ticketPage.available') : t('ticketPage.away')}
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
            disabled={isPendingAssign || !selectedAssignee || selectedAssignee === ticket.assignedToId}
            className="btn btn-primary btn-sm w-full"
          >
            {isPendingAssign ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserCheck className="w-3.5 h-3.5" />}
            <span>{ticket.assignedTo ? t('ticketPage.reassignTicket') : t('ticketPage.assignTicket')}</span>
          </button>
        </form>
      )}
    </div>
  )
}
