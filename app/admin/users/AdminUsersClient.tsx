'use client'

import { useState, useTransition, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Users,
  Clock,
  CheckCircle2,
  XCircle,
  Search,
  ChevronDown,
  Loader2,
  Shield,
  User,
  Wrench,
  X,
  Filter,
  Ban,
  Activity,
  UserPlus,
  Mail,
  Edit2
} from 'lucide-react'
import { updateUserStatus, updateUserRole, bulkUpdateUserStatus, inviteUser } from '@/app/actions/admin'
import { useIsClient } from '@/lib/useIsClient'
import { useTranslation, getCategoryLabel } from '@/lib/i18n'
import { parseSkills } from '@/lib/skills'
import { getRoleLabel } from '@/lib/roles'
import type { Role } from '@/lib/session'
import { formatRelativeTime } from '@/lib/utils'

// ── Types ────────────────────────────────────────────────────────────────────
type UserRow = {
  id: string
  name: string
  email: string
  role: string
  accountStatus: string
  skills: string
  isAvailable: boolean
  createdAt: string
  lastLoginAt: string | null
  stats: {
    createdTickets: number
    assignedTickets: number
  }
}

type Props = {
  users: UserRow[]
  counts: { total: number; pending: number; approved: number; rejected: number; suspended: number; invited: number }
  /** Ticket categories; agent skills are chosen from these */
  categories: string[]
  /** Account-status filter from the URL (?status=PENDING from the sidebar) */
  initialStatus?: string
  /** The signed-in admin, who can't change their own role or status */
  currentUserId: string
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const { locale } = useTranslation()
  const map: Record<string, string> = {
    PENDING: 'bg-amber-500/12 border-amber-500/30 text-amber-600 dark:text-amber-400',
    APPROVED: 'bg-emerald-500/12 border-emerald-500/30 text-emerald-700 dark:text-emerald-400',
    REJECTED: 'bg-red-500/12 border-red-500/30 text-red-600 dark:text-red-400',
    SUSPENDED: 'bg-gray-500/12 border-gray-500/30 text-gray-600 dark:text-gray-400',
    INVITED: 'bg-blue-500/12 border-blue-500/30 text-blue-600 dark:text-blue-400',
  }
  const labels: Record<string, { en: string; ar: string }> = {
    PENDING: { en: 'Pending', ar: 'قيد المراجعة' },
    APPROVED: { en: 'Approved', ar: 'موافق عليه' },
    REJECTED: { en: 'Rejected', ar: 'مرفوض' },
    SUSPENDED: { en: 'Suspended', ar: 'معلّق' },
    INVITED: { en: 'Invited', ar: 'تمت الدعوة' },
  }
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${map[status] || 'bg-muted border-border text-muted-foreground'}`}>
      {status === 'PENDING' && <Clock className="w-3 h-3" />}
      {status === 'APPROVED' && <CheckCircle2 className="w-3 h-3" />}
      {status === 'REJECTED' && <XCircle className="w-3 h-3" />}
      {status === 'SUSPENDED' && <Ban className="w-3 h-3" />}
      {status === 'INVITED' && <Mail className="w-3 h-3" />}
      {labels[status]?.[locale] || status}
    </span>
  )
}

function RoleBadge({ role }: { role: string }) {
  const { locale } = useTranslation()
  const map: Record<string, string> = {
    EMPLOYEE: 'bg-purple-500/10 border-purple-500/25 text-purple-600 dark:text-purple-400',
    IT_SUPPORT: 'bg-indigo-500/10 border-indigo-500/25 text-indigo-600 dark:text-indigo-400',
    ADMIN: 'bg-rose-500/10 border-rose-500/25 text-rose-600 dark:text-rose-400',
  }
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${map[role] || 'bg-muted border-border text-muted-foreground'}`}>
      {role === 'ADMIN' && <Shield className="w-3 h-3" />}
      {role === 'EMPLOYEE' && <User className="w-3 h-3" />}
      {role === 'IT_SUPPORT' && <Wrench className="w-3 h-3" />}
      {getRoleLabel(role, locale)}
    </span>
  )
}

// ── Invite User Modal ─────────────────────────────────────────────────────────
function InviteUserModal({ onClose }: { onClose: () => void }) {
  const { t, locale } = useTranslation()
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<Role>('EMPLOYEE')
  const [tempPassword, setTempPassword] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [isPending, startTransition] = useTransition()
  const mounted = useIsClient()

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault()
    startTransition(async () => {
      const res = await inviteUser({ name, email, role })
      if (res.error) {
        toast.error(t(`errors.${res.error}`, res.params))
      } else if (res.tempPassword) {
        setTempPassword(res.tempPassword)
        router.refresh()
      }
    })
  }

  const copy = async () => {
    if (!tempPassword) return
    await navigator.clipboard.writeText(tempPassword)
    setCopied(true)
  }

  const inputClass = 'w-full bg-background border border-border rounded-xl px-3 py-2 text-sm'

  const content = (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-card w-full max-w-md rounded-2xl border border-border p-6 shadow-xl relative">
        <button onClick={onClose} className="absolute end-4 top-4 text-muted-foreground hover:text-foreground" aria-label={t('common.cancel')}>
          <X className="w-5 h-5" />
        </button>

        {tempPassword ? (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">{t('invite.createdTitle')}</h2>
            <p className="text-sm text-muted-foreground">{t('invite.createdIntro', { name })}</p>
            <div className="flex items-center gap-2">
              <code dir="ltr" className="flex-1 text-center text-lg font-mono tracking-wider bg-muted rounded-xl px-3 py-2 select-all">
                {tempPassword}
              </code>
              <button type="button" onClick={copy} className="px-3 py-2 rounded-xl text-sm font-medium border border-border hover:bg-muted">
                {copied ? t('invite.copied') : t('invite.copy')}
              </button>
            </div>
            <div className="flex justify-end">
              <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-medium bg-primary text-primary-foreground">
                {t('invite.done')}
              </button>
            </div>
          </div>
        ) : (
          <>
            <h2 className="text-xl font-bold mb-4">{t('invite.title')}</h2>
            <form onSubmit={handleInvite} className="space-y-4">
              <div>
                <label htmlFor="invite-name" className="block text-xs font-semibold text-muted-foreground mb-1">{t('invite.name')}</label>
                <input id="invite-name" required minLength={2} value={name} onChange={e => setName(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label htmlFor="invite-email" className="block text-xs font-semibold text-muted-foreground mb-1">{t('invite.email')}</label>
                <input id="invite-email" type="email" required value={email} onChange={e => setEmail(e.target.value)} className={inputClass} placeholder="user@company.com" dir="ltr" />
              </div>
              <div>
                <label htmlFor="invite-role" className="block text-xs font-semibold text-muted-foreground mb-1">{t('invite.role')}</label>
                <select id="invite-role" value={role} onChange={e => setRole(e.target.value as Role)} className={inputClass}>
                  {(['EMPLOYEE', 'IT_SUPPORT', 'ADMIN'] as const).map((r) => (
                    <option key={r} value={r}>{getRoleLabel(r, locale)}</option>
                  ))}
                </select>
              </div>
              <p className="text-xs text-muted-foreground">{t('invite.note')}</p>
              <div className="flex justify-end gap-2 mt-6">
                <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-medium hover:bg-muted text-muted-foreground">{t('common.cancel')}</button>
                <button type="submit" disabled={isPending} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-primary text-primary-foreground disabled:opacity-50">
                  {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  {isPending ? t('invite.creating') : t('invite.create')}
                </button>
              </div>
            </form>
          </>
        )}
      </motion.div>
    </div>
  )

  if (!mounted) return null
  return createPortal(content, document.body)
}

// ── Edit User Modal ───────────────────────────────────────────────────────────
function EditUserModal({ user, categories, onClose }: { user: UserRow; categories: string[]; onClose: () => void }) {
  const { t, locale } = useTranslation()
  const router = useRouter()
  const [role, setRole] = useState(user.role as Role)
  const [skills, setSkills] = useState<string[]>(parseSkills(user.skills))
  const [isPending, startTransition] = useTransition()
  const mounted = useIsClient()

  const toggleSkill = (skill: string) =>
    setSkills(prev => prev.includes(skill) ? prev.filter(s => s !== skill) : [...prev, skill])

  const handleSave = () => {
    startTransition(async () => {
      const res = await updateUserRole(user.id, role, role === 'IT_SUPPORT' ? skills : [])
      if (res.error) {
        toast.error(t(`errors.${res.error}`, res.params))
      } else {
        toast.success(t('toasts.userUpdated'))
        router.refresh()
        onClose()
      }
    })
  }

  const content = (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-card w-full max-w-md rounded-2xl border border-border p-6 shadow-xl relative">
        <button onClick={onClose} className="absolute right-4 top-4 text-muted-foreground hover:text-foreground">
          <X className="w-5 h-5" />
        </button>
        <h2 className="text-xl font-bold mb-4">{locale === 'ar' ? `تعديل المستخدم: ${user.name}` : `Edit User: ${user.name}`}</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">{t('invite.role')}</label>
            <select value={role} onChange={e => setRole(e.target.value as Role)} className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm">
              {(['EMPLOYEE', 'IT_SUPPORT', 'ADMIN'] as const).map((r) => (
                <option key={r} value={r}>{getRoleLabel(r, locale)}</option>
              ))}
            </select>
          </div>
          
          {role === 'IT_SUPPORT' && (
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-2">{locale === 'ar' ? 'المهارات المعينة' : 'Assigned Skills'}</label>
              <div className="grid grid-cols-2 gap-2">
                {categories.map(skill => (
                  <label key={skill} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={skills.includes(skill)} onChange={() => toggleSkill(skill)} className="rounded border-border text-indigo-600 focus:ring-indigo-500" />
                    {getCategoryLabel(skill, locale)}
                  </label>
                ))}
              </div>
            </div>
          )}
          
          <div className="flex justify-end gap-2 mt-6">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-medium hover:bg-muted text-muted-foreground">{t('common.cancel')}</button>
            <button type="button" onClick={handleSave} disabled={isPending} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-primary text-primary-foreground disabled:opacity-50">
              {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              {locale === 'ar' ? 'حفظ التغييرات' : 'Save Changes'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  )

  if (!mounted) return null
  return createPortal(content, document.body)
}

// ── User Row ─────────────────────────────────────────────────────────────────
function UserTableRow({ user, categories, selected, onToggle, isSelf }: { user: UserRow; categories: string[]; selected: boolean; onToggle: () => void; isSelf: boolean }) {
  const { t, locale } = useTranslation()
  const router = useRouter()
  const [isPendingStatus, startStatusTransition] = useTransition()
  const [showEdit, setShowEdit] = useState(false)
  const skills = parseSkills(user.skills)
  const initials = user.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()

  const handleStatusChange = (status: 'APPROVED' | 'REJECTED' | 'PENDING' | 'SUSPENDED') => {
    startStatusTransition(async () => {
      const result = await updateUserStatus(user.id, status)
      if (result.error) toast.error(t(`errors.${result.error}`, result.params))
      else {
        toast.success(t('toasts.userStatusUpdated'))
        router.refresh()
      }
    })
  }

  return (
    <motion.tr
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={`border-b border-border last:border-0 hover:bg-muted/30 transition-colors group ${selected ? 'bg-indigo-500/5' : ''}`}
    >
      <td className="px-4 py-3 w-10">
        <input 
          type="checkbox" 
          checked={selected} 
          onChange={onToggle}
          className="rounded border-border text-indigo-600 focus:ring-indigo-500 cursor-pointer"
        />
      </td>
      
      {/* User */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 text-xs font-bold shrink-0">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{user.name}</p>
            <p className="text-[11px] text-muted-foreground truncate">{user.email}</p>
          </div>
        </div>
      </td>

      {/* Status */}
      <td className="px-4 py-3">
        <StatusBadge status={user.accountStatus} />
      </td>

      {/* Role */}
      <td className="px-4 py-3">
        <RoleBadge role={user.role} />
      </td>

      {/* Skills */}
      <td className="px-4 py-3">
        {user.role === 'IT_SUPPORT' ? (
          <div className="flex flex-wrap gap-1">
            {skills.length > 0 ? (
              skills.slice(0, 2).map((s) => (
                <span key={s} className="text-[10px] px-1.5 py-0.5 rounded-md bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 font-medium">
                  {getCategoryLabel(s, locale)}
                </span>
              ))
            ) : <span className="text-[10px] text-muted-foreground">{t('ui.none')}</span>}
            {skills.length > 2 && <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground font-medium">+{skills.length - 2}</span>}
          </div>
        ) : (
          <span className="text-[11px] text-muted-foreground">—</span>
        )}
      </td>

      {/* Activity */}
      <td className="px-4 py-3">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Clock className="w-3 h-3" /> 
            {user.lastLoginAt ? (locale === 'ar' ? `آخر دخول: ${formatRelativeTime(user.lastLoginAt, locale)}` : `Last login: ${formatRelativeTime(user.lastLoginAt, locale)}`) : (locale === 'ar' ? 'لم يسجل الدخول مسبقاً' : 'Never logged in')}
          </div>
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Activity className="w-3 h-3" />
            {user.role === 'IT_SUPPORT' ? (locale === 'ar' ? `${user.stats.assignedTickets} منجزة` : `${user.stats.assignedTickets} resolved`) : (locale === 'ar' ? `${user.stats.createdTickets} مقدمة` : `${user.stats.createdTickets} submitted`)}
          </div>
        </div>
      </td>

      {/* Actions */}
      <td className="px-4 py-3">
        {isSelf ? (
          <span className="text-[11px] text-muted-foreground italic">{t('ui.thisIsYou')}</span>
        ) : (
        <div className="flex items-center gap-2">
          {user.accountStatus === 'PENDING' && (
            <>
              <button onClick={() => handleStatusChange('APPROVED')} disabled={isPendingStatus} className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-500/10 transition-colors" title={t('ui.approve')}>
                {isPendingStatus ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              </button>
              <button onClick={() => handleStatusChange('REJECTED')} disabled={isPendingStatus} className="p-1.5 rounded-lg text-red-600 hover:bg-red-500/10 transition-colors" title={t('ui.reject')}>
                {isPendingStatus ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
              </button>
            </>
          )}

          {/* Suspending an invited account also cancels the invite */}
          {(user.accountStatus === 'APPROVED' || user.accountStatus === 'INVITED') && (
            <button onClick={() => handleStatusChange('SUSPENDED')} disabled={isPendingStatus} className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-500/10 transition-colors" title={t('ui.suspend')}>
              {isPendingStatus ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ban className="w-4 h-4" />}
            </button>
          )}

          {user.accountStatus === 'SUSPENDED' && (
            <button onClick={() => handleStatusChange('APPROVED')} disabled={isPendingStatus} className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-500/10 transition-colors" title={t('ui.reactivate')}>
              {isPendingStatus ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            </button>
          )}
          
          <button onClick={() => setShowEdit(true)} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" title={t('ui.editRoleSkills')}>
            <Edit2 className="w-4 h-4" />
          </button>
        </div>
        )}
      </td>
      {showEdit && <EditUserModal user={user} categories={categories} onClose={() => setShowEdit(false)} />}
    </motion.tr>
  )
}

// ── Main Client Component ─────────────────────────────────────────────────────
export default function AdminUsersClient({ users, counts, categories, initialStatus = '', currentUserId }: Props) {
  const router = useRouter()
  const { t, locale } = useTranslation()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>(initialStatus)
  const [roleFilter, setRoleFilter] = useState<string>('')
  
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [isBulkPending, startBulkTransition] = useTransition()

  const filtered = useMemo(() => {
    let list = users
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(
        (u) =>
          u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          u.role.toLowerCase().includes(q),
      )
    }
    if (statusFilter) list = list.filter((u) => u.accountStatus === statusFilter)
    if (roleFilter) list = list.filter((u) => u.role === roleFilter)
    return list
  }, [users, search, statusFilter, roleFilter])

  const hasFilters = Boolean(search || statusFilter || roleFilter)
  const pendingUsers = filtered.filter(u => u.accountStatus === 'PENDING')
  const allPendingSelected = pendingUsers.length > 0 && pendingUsers.every(u => selectedIds.has(u.id))

  const toggleSelectAll = () => {
    if (allPendingSelected) {
      const next = new Set(selectedIds)
      pendingUsers.forEach(u => next.delete(u.id))
      setSelectedIds(next)
    } else {
      const next = new Set(selectedIds)
      pendingUsers.forEach(u => next.add(u.id))
      setSelectedIds(next)
    }
  }

  const toggleRow = (id: string) => {
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedIds(next)
  }

  const handleBulkAction = (action: 'APPROVED' | 'REJECTED') => {
    startBulkTransition(async () => {
      const res = await bulkUpdateUserStatus(Array.from(selectedIds), action)
      if (res.error) toast.error(t(`errors.${res.error}`, res.params))
      else {
        toast.success(t('toasts.bulkUpdated', { count: selectedIds.size }))
        setSelectedIds(new Set())
        router.refresh()
      }
    })
  }

  return (
    <div className="space-y-6 animate-fade-up pb-20">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">{locale === 'ar' ? 'إدارة المستخدمين' : 'User Management'}</h1>
          <p className="text-base font-normal text-muted-foreground/90 mt-1.5">
            {locale === 'ar' ? 'مراجعة طلبات التسجيل، وإدارة الأدوار والصلاحيات، ومتابعة نشاط الحسابات.' : 'Review registration requests, manage roles, and monitor account activity.'}
          </p>
        </div>
        <button onClick={() => setShowInviteModal(true)} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm">
          <UserPlus className="w-4 h-4" /> {locale === 'ar' ? 'دعوة مستخدم' : 'Invite User'}
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {[
          { label: locale === 'ar' ? 'الإجمالي' : 'Total', value: counts.total, icon: <Users className="w-4 h-4" />, color: 'text-indigo-500', bg: 'bg-indigo-500/10 border-indigo-500/20' },
          { label: locale === 'ar' ? 'قيد المراجعة' : 'Pending', value: counts.pending, icon: <Clock className="w-4 h-4" />, color: 'text-amber-500', bg: 'bg-amber-500/10 border-amber-500/20' },
          { label: locale === 'ar' ? 'موافق عليه' : 'Approved', value: counts.approved, icon: <CheckCircle2 className="w-4 h-4" />, color: 'text-emerald-500', bg: 'bg-emerald-500/10 border-emerald-500/20' },
          { label: locale === 'ar' ? 'مرفوض' : 'Rejected', value: counts.rejected, icon: <XCircle className="w-4 h-4" />, color: 'text-red-500', bg: 'bg-red-500/10 border-red-500/20' },
          { label: locale === 'ar' ? 'معلّق' : 'Suspended', value: counts.suspended, icon: <Ban className="w-4 h-4" />, color: 'text-gray-500', bg: 'bg-gray-500/10 border-gray-500/20' },
          { label: locale === 'ar' ? 'تمت الدعوة' : 'Invited', value: counts.invited, icon: <Mail className="w-4 h-4" />, color: 'text-blue-500', bg: 'bg-blue-500/10 border-blue-500/20' },
        ].map((card) => (
          <div key={card.label} className="rounded-2xl bg-card border border-border p-3 flex items-center gap-3 shadow-sm">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center border ${card.bg} ${card.color} shrink-0`}>
              {card.icon}
            </div>
            <div>
              <p className="text-lg font-bold text-foreground leading-tight">{card.value}</p>
              <p className="text-[10px] text-muted-foreground">{card.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters row & Bulk Actions */}
      <div className="flex flex-col lg:flex-row gap-3 justify-between items-start lg:items-center">
        <div className="flex flex-wrap gap-3 flex-1 w-full lg:w-auto">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <input type="text" placeholder={locale === 'ar' ? 'البحث بالاسم أو البريد الإلكتروني...' : 'Search by name or email…'} value={search} onChange={(e) => setSearch(e.target.value)} className="w-full bg-card border border-border rounded-xl pl-9 pr-3.5 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-all focus:border-indigo-500/70" />
          </div>

          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="appearance-none bg-card border border-border rounded-xl pl-8 pr-8 py-2 text-sm text-foreground outline-none transition-all focus:border-indigo-500/70 cursor-pointer">
              <option value="">{locale === 'ar' ? 'كافة الحالات' : 'All Statuses'}</option>
              <option value="PENDING">{locale === 'ar' ? 'قيد المراجعة' : 'Pending'}</option>
              <option value="APPROVED">{locale === 'ar' ? 'موافق عليه' : 'Approved'}</option>
              <option value="REJECTED">{locale === 'ar' ? 'مرفوض' : 'Rejected'}</option>
              <option value="SUSPENDED">{locale === 'ar' ? 'معلّق' : 'Suspended'}</option>
              <option value="INVITED">{locale === 'ar' ? 'تمت الدعوة' : 'Invited'}</option>
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          </div>

          <div className="relative">
            <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="appearance-none bg-card border border-border rounded-xl pl-3.5 pr-8 py-2 text-sm text-foreground outline-none transition-all focus:border-indigo-500/70 cursor-pointer">
              <option value="">{locale === 'ar' ? 'كافة الأدوار' : 'All Roles'}</option>
              {(['EMPLOYEE', 'IT_SUPPORT', 'ADMIN'] as const).map((r) => (
                <option key={r} value={r}>{getRoleLabel(r, locale)}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          </div>
        </div>
        
        {/* Bulk Actions Panel */}
        {selectedIds.size > 0 && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-3 bg-indigo-500/10 border border-indigo-500/20 px-4 py-1.5 rounded-xl">
            <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-400">{selectedIds.size} {locale === 'ar' ? 'محدد' : 'selected'}</span>
            <div className="h-4 w-px bg-indigo-500/30" />
            <button onClick={() => handleBulkAction('APPROVED')} disabled={isBulkPending} className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 hover:text-emerald-700 disabled:opacity-50">
              <CheckCircle2 className="w-3.5 h-3.5" /> {locale === 'ar' ? 'موافقة على الكل' : 'Approve All'}
            </button>
            <button onClick={() => handleBulkAction('REJECTED')} disabled={isBulkPending} className="flex items-center gap-1.5 text-xs font-semibold text-red-600 hover:text-red-700 disabled:opacity-50">
              <XCircle className="w-3.5 h-3.5" /> {locale === 'ar' ? 'رفض الكل' : 'Reject All'}
            </button>
          </motion.div>
        )}
      </div>

      {/* Table */}
      <div className="rounded-2xl bg-card border border-border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-start">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="px-4 py-3 w-10">
                  <input 
                    type="checkbox" 
                    checked={allPendingSelected} 
                    onChange={toggleSelectAll} 
                    disabled={pendingUsers.length === 0}
                    className="rounded border-border text-indigo-600 focus:ring-indigo-500 cursor-pointer disabled:opacity-50"
                    title={t('ui.selectAllPending')}
                  />
                </th>
                <th className="px-4 py-3 text-sm font-medium text-muted-foreground uppercase tracking-wider">{locale === 'ar' ? 'المستخدم' : 'User'}</th>
                <th className="px-4 py-3 text-sm font-medium text-muted-foreground uppercase tracking-wider">{locale === 'ar' ? 'الحالة' : 'Status'}</th>
                <th className="px-4 py-3 text-sm font-medium text-muted-foreground uppercase tracking-wider">{locale === 'ar' ? 'الدور' : 'Role'}</th>
                <th className="px-4 py-3 text-sm font-medium text-muted-foreground uppercase tracking-wider">{locale === 'ar' ? 'المهارات' : 'Skills'}</th>
                <th className="px-4 py-3 text-sm font-medium text-muted-foreground uppercase tracking-wider">{locale === 'ar' ? 'النشاط' : 'Activity'}</th>
                <th className="px-4 py-3 text-sm font-medium text-muted-foreground uppercase tracking-wider">{locale === 'ar' ? 'الإجراءات' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence mode="popLayout">
                {filtered.map((user) => (
                  <UserTableRow 
                    key={user.id} 
                    user={user} 
                    categories={categories}
                    selected={selectedIds.has(user.id)}
                    onToggle={() => toggleRow(user.id)}
                    isSelf={user.id === currentUserId}
                  />
                ))}
              </AnimatePresence>
            </tbody>
          </table>

          {filtered.length === 0 && (
            <div className="text-center py-16 text-muted-foreground">
              <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium">{t('ui.noUsersMatch')}</p>
              {hasFilters && (
                <button
                  type="button"
                  onClick={() => { setSearch(''); setStatusFilter(''); setRoleFilter('') }}
                  className="mt-2 text-xs text-indigo-500 hover:text-indigo-400 underline cursor-pointer"
                >
                  {t('ui.clearAllFilters')}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Table footer count */}
        <div className="px-4 py-3 border-t border-border bg-muted/20 text-[11px] text-muted-foreground flex justify-between">
          <span>{t('ui.showingUsers', { shown: filtered.length, total: users.length })}</span>
        </div>
      </div>

      {showInviteModal && <InviteUserModal onClose={() => setShowInviteModal(false)} />}
    </div>
  )
}
