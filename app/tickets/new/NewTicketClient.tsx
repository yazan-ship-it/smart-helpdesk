'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  AlertCircle,
  ArrowLeft,
  Bot,
  CheckCircle2,
  ChevronDown,
  Clock,
  FileText,
  Lightbulb,
  Loader2,
  RotateCcw,
  Sparkles,
  Upload,
  X,
} from 'lucide-react'
import { createTicket, type TicketState } from '@/app/actions/tickets'
import { useTranslation, getCategoryLabel, getPriorityLabel } from '@/lib/i18n'
import { PRIORITIES, type Priority, type TriageSuggestion } from '@/lib/ai/triage'
import { DESCRIPTION_MAX, TITLE_MAX } from '@/lib/ticket-rules'
import { ACCEPT_ATTRIBUTE, ALLOWED_TYPES, MAX_FILES, MAX_FILE_SIZE, MAX_FILE_SIZE_MB, fileExtension } from '@/lib/uploads'

type Attachment = { name: string; size: number; type: string; url: string; preview?: string }

type Props = {
  categories: string[]
  defaultPriority: Priority
  slaHours: Record<Priority, number>
  businessHours: { start: string; end: string }
  suggestionsEnabled: boolean
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function readAsDataUrl(file: File) {
  return new Promise<string>((resolve) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.readAsDataURL(file)
  })
}

const inputClass =
  'w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-colors focus:border-indigo-500/70 focus:ring-2 focus:ring-indigo-500/20'

export default function NewTicketClient({ categories, defaultPriority, slaHours, businessHours, suggestionsEnabled }: Props) {
  const { t, locale } = useTranslation()
  const [state, action, pending] = useActionState<TicketState, FormData>(createTicket, undefined)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [priority, setPriority] = useState<Priority>(defaultPriority)

  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [suggestion, setSuggestion] = useState<TriageSuggestion | null>(null)
  const [suggestionStatus, setSuggestionStatus] = useState<'idle' | 'loading' | 'unavailable'>('idle')
  // Form values before a suggestion was applied, so it can be undone
  const [beforeApply, setBeforeApply] = useState<{ category: string; priority: Priority } | null>(null)

  useEffect(() => {
    if (state?.error) toast.error(t(`errors.${state.error}`))
    else if (state?.fieldErrors) toast.error(t('newTicket.fixErrors'))
  }, [state, t])

  const textChanged = () => {
    // A suggestion describes the text it was made for; drop it once the text changes
    if (suggestion && !beforeApply) setSuggestion(null)
    if (suggestionStatus === 'unavailable') setSuggestionStatus('idle')
  }

  const requestSuggestion = async () => {
    if (!title.trim() && !description.trim()) {
      toast.error(t('newTicket.ai.needText'))
      return
    }
    setSuggestionStatus('loading')
    setBeforeApply(null)
    try {
      const res = await fetch('/api/ai/triage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description, locale }),
      })
      if (!res.ok) throw new Error(String(res.status))
      setSuggestion((await res.json()) as TriageSuggestion)
      setSuggestionStatus('idle')
    } catch {
      setSuggestion(null)
      setSuggestionStatus('unavailable')
    }
  }

  const applySuggestion = () => {
    if (!suggestion) return
    setBeforeApply({ category, priority })
    if (categories.includes(suggestion.category)) setCategory(suggestion.category)
    setPriority(suggestion.priority)
    toast.success(t('newTicket.ai.applied'))
  }

  const undoSuggestion = () => {
    if (!beforeApply) return
    setCategory(beforeApply.category)
    setPriority(beforeApply.priority)
    setBeforeApply(null)
  }

  const uploadFiles = async (files: File[]) => {
    if (!files.length) return
    const invalid = files.find((f) => !ALLOWED_TYPES[fileExtension(f.name)] || f.size > MAX_FILE_SIZE)
    if (invalid || attachments.length + files.length > MAX_FILES) {
      toast.error(t('newTicket.attachmentRules', { files: MAX_FILES, size: MAX_FILE_SIZE_MB }))
      return
    }

    setUploading(true)
    const formData = new FormData()
    files.forEach((f) => formData.append('files', f))
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ? t(`errors.${data.error}`, data.params) : t('newTicket.uploadFailed'))

      const uploaded = await Promise.all(
        (data.attachments as Attachment[]).map(async (att, i) =>
          att.type.startsWith('image/') ? { ...att, preview: await readAsDataUrl(files[i]) } : att
        )
      )
      setAttachments((prev) => [...prev, ...uploaded])
      toast.success(t('newTicket.filesAttached', { count: files.length }))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('newTicket.uploadFailed'))
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const resetForm = () => {
    setTitle('')
    setDescription('')
    setCategory('')
    setPriority(defaultPriority)
    setAttachments([])
    setSuggestion(null)
    setSuggestionStatus('idle')
    setBeforeApply(null)
    toast.info(t('newTicket.formCleared'))
  }

  const hasInput = Boolean(title.trim() || description.trim() || category || attachments.length)
  const fieldError = (field: 'title' | 'description' | 'category') =>
    state?.fieldErrors?.[field] ? (
      <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1">
        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
        {t(`newTicket.errors.${field}`)}
      </p>
    ) : null

  return (
    <div className="animate-fade-up">
      <div className="page-header">
        <Link
          href="/tickets"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors mb-3"
        >
          <ArrowLeft className="w-3.5 h-3.5 rtl:rotate-180" />
          <span>{t('tickets.backToTickets')}</span>
        </Link>
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">{t('newTicket.title')}</h1>
        <p className="text-base text-muted-foreground mt-1.5">{t('newTicket.subtitle')}</p>
      </div>

      <div className="page-content">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* ── Form ── */}
          <div className="lg:col-span-7 xl:col-span-8">
            <form
              action={(formData) => {
                formData.set('category', category)
                formData.set('priority', priority)
                formData.set(
                  'attachmentsJson',
                  JSON.stringify(attachments.map(({ name, size, type, url }) => ({ name, size, type, url })))
                )
                return action(formData)
              }}
              className="rounded-2xl bg-card border border-border p-6 sm:p-7 shadow-sm space-y-6"
            >
              <div>
                <div className="flex items-center justify-between mb-1.5 gap-3">
                  <label htmlFor="title" className="text-xs font-semibold text-foreground">
                    {t('newTicket.summaryLabel')} <span className="text-red-500">*</span>
                  </label>
                  <span className="text-[11px] text-muted-foreground">{t('newTicket.summaryHint')}</span>
                </div>
                <input
                  id="title"
                  name="title"
                  required
                  maxLength={TITLE_MAX}
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value)
                    textChanged()
                  }}
                  placeholder={t('newTicket.summaryPlaceholder')}
                  className={inputClass}
                />
                {fieldError('title')}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5 gap-3">
                  <label htmlFor="description" className="text-xs font-semibold text-foreground">
                    {t('newTicket.descriptionLabel')} <span className="text-red-500">*</span>
                  </label>
                  <span className="text-[11px] text-muted-foreground">{t('newTicket.descriptionHint')}</span>
                </div>
                <textarea
                  id="description"
                  name="description"
                  required
                  rows={6}
                  maxLength={DESCRIPTION_MAX}
                  value={description}
                  onChange={(e) => {
                    setDescription(e.target.value)
                    textChanged()
                  }}
                  placeholder={t('newTicket.descriptionPlaceholder')}
                  className={`${inputClass} resize-none leading-relaxed`}
                />
                {fieldError('description')}
              </div>

              {/* Attachments */}
              <div>
                <p className="text-xs font-semibold text-foreground mb-2">
                  {t('newTicket.attachmentsLabel')} <span className="text-muted-foreground font-normal">{t('newTicket.optional')}</span>
                </p>
                <button
                  type="button"
                  className={`w-full border border-dashed rounded-xl p-6 text-center transition-colors cursor-pointer ${
                    dragOver ? 'border-indigo-500 bg-indigo-500/10' : 'border-border bg-background/40 hover:bg-background/60'
                  }`}
                  onDrop={(e) => {
                    e.preventDefault()
                    setDragOver(false)
                    uploadFiles(Array.from(e.dataTransfer.files))
                  }}
                  onDragOver={(e) => {
                    e.preventDefault()
                    setDragOver(true)
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? (
                    <span className="flex items-center justify-center gap-2 py-2 text-xs font-medium text-foreground">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      {t('newTicket.uploading')}
                    </span>
                  ) : (
                    <span className="space-y-1.5 block">
                      <Upload className="w-6 h-6 mx-auto text-muted-foreground" />
                      <span className="block text-xs font-medium text-foreground">
                        {t('newTicket.dropFiles')}{' '}
                        <span className="text-indigo-600 dark:text-indigo-400 underline underline-offset-2">{t('newTicket.browse')}</span>
                      </span>
                      <span className="block text-[11px] text-muted-foreground">
                        {t('newTicket.attachmentRules', { files: MAX_FILES, size: MAX_FILE_SIZE_MB })}
                      </span>
                    </span>
                  )}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  accept={ACCEPT_ATTRIBUTE}
                  onChange={(e) => uploadFiles(Array.from(e.target.files ?? []))}
                />

                {attachments.length > 0 && (
                  <ul className="mt-3 space-y-2">
                    {attachments.map((att) => (
                      <li key={att.url} className="flex items-center gap-3 p-2.5 rounded-xl bg-background/80 border border-border">
                        {att.preview ? (
                          // eslint-disable-next-line @next/next/no-img-element -- local data: preview, next/image can't optimize it
                          <img src={att.preview} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0 border border-border" />
                        ) : (
                          <span className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                            <FileText className="w-5 h-5 text-muted-foreground" />
                          </span>
                        )}
                        <span className="flex-1 min-w-0">
                          <span className="block text-xs font-medium text-foreground truncate">{att.name}</span>
                          <span className="block text-[11px] text-muted-foreground">{formatBytes(att.size)}</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => setAttachments((prev) => prev.filter((a) => a.url !== att.url))}
                          className="p-1 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-muted transition-colors"
                          aria-label={t('newTicket.removeAttachment')}
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Category & priority */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="category" className="block text-xs font-semibold text-foreground mb-1.5">
                    {t('newTicket.categoryLabel')} <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <select
                      id="category"
                      required
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className={`${inputClass} appearance-none pe-10 cursor-pointer`}
                    >
                      <option value="">{t('newTicket.categoryPlaceholder')}</option>
                      {categories.map((c) => (
                        <option key={c} value={c}>
                          {getCategoryLabel(c, locale)}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute end-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                  </div>
                  {fieldError('category')}
                </div>

                <div>
                  <label htmlFor="priority" className="block text-xs font-semibold text-foreground mb-1.5">
                    {t('newTicket.priorityLabel')}
                  </label>
                  <div className="relative">
                    <select
                      id="priority"
                      value={priority}
                      onChange={(e) => setPriority(e.target.value as Priority)}
                      className={`${inputClass} appearance-none pe-10 cursor-pointer`}
                    >
                      {PRIORITIES.map((p) => (
                        <option key={p} value={p}>
                          {t(`newTicket.priorityHelp.${p}`)}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute end-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-border">
                <button
                  type="submit"
                  disabled={pending || uploading}
                  className="inline-flex items-center justify-center gap-2 py-2.5 px-6 rounded-xl text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {pending && <Loader2 className="w-4 h-4 animate-spin" />}
                  {pending ? t('newTicket.submitting') : t('newTicket.submit')}
                </button>
                <Link href="/tickets" className="btn btn-secondary text-xs">
                  {t('newTicket.cancel')}
                </Link>
                {hasInput && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="ms-auto inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    {t('newTicket.reset')}
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* ── Side panel ── */}
          <div className="lg:col-span-5 xl:col-span-4 space-y-5 lg:sticky lg:top-8">
            {suggestionsEnabled && (
              <section className="rounded-2xl bg-card border border-border p-5 shadow-sm space-y-4" aria-live="polite">
                <div className="flex items-start gap-2.5">
                  <span className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                    <Sparkles className="w-4 h-4" />
                  </span>
                  <div>
                    <h2 className="text-sm font-bold text-foreground">{t('newTicket.ai.heading')}</h2>
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{t('newTicket.ai.intro')}</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={requestSuggestion}
                  disabled={suggestionStatus === 'loading' || (!title.trim() && !description.trim())}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  {suggestionStatus === 'loading' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  {suggestionStatus === 'loading' ? t('newTicket.ai.running') : t('newTicket.ai.run')}
                </button>

                {suggestionStatus === 'unavailable' && (
                  <p className="text-xs text-amber-700 dark:text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
                    {t('newTicket.ai.unavailable')}
                  </p>
                )}

                {suggestion && (
                  <div className="space-y-3">
                    <span
                      className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full border ${
                        suggestion.source === 'ai'
                          ? 'bg-indigo-500/10 border-indigo-500/25 text-indigo-700 dark:text-indigo-300'
                          : 'bg-muted border-border text-muted-foreground'
                      }`}
                    >
                      {suggestion.source === 'ai' ? <Sparkles className="w-3 h-3" /> : <Bot className="w-3 h-3" />}
                      {suggestion.source === 'ai' ? t('newTicket.ai.sourceAi') : t('newTicket.ai.sourceRules')}
                    </span>

                    <dl className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2.5 rounded-xl bg-background border border-border">
                        <dt className="text-[11px] text-muted-foreground mb-1">{t('newTicket.ai.category')}</dt>
                        <dd className="font-semibold text-foreground">{getCategoryLabel(suggestion.category, locale)}</dd>
                      </div>
                      <div className="p-2.5 rounded-xl bg-background border border-border">
                        <dt className="text-[11px] text-muted-foreground mb-1">{t('newTicket.ai.priority')}</dt>
                        <dd className="font-semibold text-foreground">{getPriorityLabel(suggestion.priority, locale)}</dd>
                      </div>
                    </dl>

                    {suggestion.reason && <p className="text-[11px] text-muted-foreground leading-relaxed">{suggestion.reason}</p>}

                    <div>
                      <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground mb-2">
                        <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
                        {t('newTicket.ai.tryFirst')}
                      </p>
                      <ol className="space-y-1.5 list-decimal ps-5 text-[12px] text-foreground leading-snug">
                        {suggestion.selfHelp.map((step) => (
                          <li key={step}>{step}</li>
                        ))}
                      </ol>
                    </div>

                    {beforeApply ? (
                      <div className="flex items-center gap-2 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                        <CheckCircle2 className="w-4 h-4" />
                        {t('newTicket.ai.applied')}
                        <button type="button" onClick={undoSuggestion} className="ms-auto underline cursor-pointer">
                          {t('newTicket.ai.undo')}
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={applySuggestion}
                          className="flex-1 py-2 rounded-xl text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-500 cursor-pointer"
                        >
                          {t('newTicket.ai.apply')}
                        </button>
                        <button
                          type="button"
                          onClick={() => setSuggestion(null)}
                          className="px-3 py-2 rounded-xl text-xs font-medium text-muted-foreground hover:text-foreground bg-muted border border-border cursor-pointer"
                        >
                          {t('newTicket.ai.dismiss')}
                        </button>
                      </div>
                    )}
                    <p className="text-[10px] text-muted-foreground">{t('newTicket.ai.disclaimer')}</p>
                  </div>
                )}
              </section>
            )}

            <section className="rounded-2xl bg-card border border-border p-4 shadow-sm">
              <p className="flex items-center gap-2 text-xs font-semibold text-foreground">
                <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                {t('newTicket.sla.heading')}
                <span className="ms-auto text-[10px] font-mono px-2 py-0.5 rounded-full border border-border text-muted-foreground">
                  {getPriorityLabel(priority, locale)}
                </span>
              </p>
              <p className="mt-2 text-sm font-semibold text-foreground">{t('newTicket.sla.value', { hours: slaHours[priority] })}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {t('newTicket.sla.note', { start: businessHours.start, end: businessHours.end })}
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}
