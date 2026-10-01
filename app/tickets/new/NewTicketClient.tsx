'use client'

import { useActionState, useState, useRef, useCallback, useEffect } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import {
 ArrowLeft,
 Sparkles,
 Loader2,
 X,
 Upload,
 FileText,
 Lightbulb,
 CheckCircle2,
 AlertCircle,
 Clock,
 Bot,
 Wand2,
 Check,
 ShieldAlert,
 RotateCcw,
 ChevronDown,
} from 'lucide-react'
import { createTicket, type TicketState } from '@/app/actions/tickets'
import { useTranslation } from '@/lib/i18n'



type TriageResult = {
 category: string
 priority: string
 selfHelp: string[]
 confidence: string
 matchScore?: number
 reason?: string
}

type Attachment = {
 name: string
 size: number
 type: string
 url: string
 preview?: string
}

function formatBytes(bytes: number) {
 if (bytes < 1024) return `${bytes} B`
 if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
 return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// Fallback smart heuristics when AI key is absent
function getSmartFallbackTriage(title: string, desc: string): TriageResult {
 const text = `${title} ${desc}`.toLowerCase()

 if (
 text.includes('vpn') ||
 text.includes('wifi') ||
 text.includes('network') ||
 text.includes('internet') ||
 text.includes('dns') ||
 text.includes('gateway')
 ) {
 return {
 category: 'Network',
 priority: text.includes('outage') || text.includes('down') ? 'CRITICAL' : 'HIGH',
 confidence: 'high',
 matchScore: 98,
 selfHelp: [
 'Disconnect and reconnect your VPN tunnel or restart the WireGuard client.',
 'Flush your local DNS cache: run `sudo dscacheutil -flushcache` or `ipconfig /flushdns`.',
 'Verify your IP address is within the corporate subnet range (10.x.x.x).',
 ],
 reason: 'Detected network gateway & connection routing issues.',
 }
 }

 if (
 text.includes('screen') ||
 text.includes('laptop') ||
 text.includes('hardware') ||
 text.includes('battery') ||
 text.includes('thermal') ||
 text.includes('monitor') ||
 text.includes('keyboard')
 ) {
 return {
 category: 'Hardware',
 priority: text.includes('fire') || text.includes('smoke') || text.includes('crash') ? 'CRITICAL' : 'MEDIUM',
 confidence: 'high',
 matchScore: 94,
 selfHelp: [
 'Perform a hard power reset by holding the power button for 15 seconds.',
 'Check cable connections and try alternate USB-C / Thunderbolt ports.',
 'Ensure the cooling vents are clear and fan speed is normal.',
 ],
 reason: 'Identified physical peripheral or system hardware diagnostic signals.',
 }
 }

 if (
 text.includes('password') ||
 text.includes('login') ||
 text.includes('access') ||
 text.includes('permission') ||
 text.includes('sso') ||
 text.includes('2fa') ||
 text.includes('mfa')
 ) {
 return {
 category: 'Access Issue',
 priority: 'HIGH',
 confidence: 'high',
 matchScore: 96,
 selfHelp: [
 'Attempt re-authenticating through company Okta / Google Workspace SSO.',
 'Clear browser cookies and session storage for the affected portal.',
 'Check with your team lead to verify if group authorization was granted.',
 ],
 reason: 'Detected credential authentication or role access policy requirements.',
 }
 }

 if (
 text.includes('license') ||
 text.includes('figma') ||
 text.includes('slack') ||
 text.includes('zoom') ||
 text.includes('software') ||
 text.includes('app') ||
 text.includes('crash')
 ) {
 return {
 category: 'Software',
 priority: 'MEDIUM',
 confidence: 'high',
 matchScore: 92,
 selfHelp: [
 'Quit the application completely and relaunch to fetch updated seat token.',
 'Check for pending app updates or reinstall from Enterprise App Catalog.',
 'Verify your account email matches your corporate directory identity.',
 ],
 reason: 'Detected software application licensing or runtime crash indicators.',
 }
 }

 return {
 category: 'Other',
 priority: 'MEDIUM',
 confidence: 'medium',
 matchScore: 85,
 selfHelp: [
 'Restart the affected application and check if the issue reproduces.',
 'Check internal status dashboard at status.company.internal for active incidents.',
 'Take a screenshot of any error codes to attach below for the IT team.',
 ],
 reason: 'Analyzed general support inquiry semantics.',
 }
}

// SLA guidance based on priority
const SLA_INFO: Record<string, { label: string; time: string; badgeClass: string }> = {
 CRITICAL: {
 label: 'Immediate P1 Escalation',
 time: '< 15 mins First Response',
 badgeClass: 'text-red-400 bg-red-500/10 border-red-500/20',
 },
 HIGH: {
 label: 'Priority Engineering Queue',
 time: '< 1 hour First Response',
 badgeClass: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
 },
 MEDIUM: {
 label: 'Standard Operational Queue',
 time: '< 4 hours First Response',
 badgeClass: 'text-amber-300 bg-amber-500/10 border-amber-500/20',
 },
 LOW: {
 label: 'Routine Maintenance Queue',
 time: '< 24 hours First Response',
 badgeClass: 'text-emerald-800 dark:text-emerald-300 dark:text-emerald-800 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950 dark:bg-emerald-100 dark:bg-emerald-950 border-emerald-500/20',
 },
}

const DEMO_SCENARIOS = [
  {
    id: 'printer',
    label: 'Office Printer Jam',
    shortLabel: 'Printer Jam',
    category: 'Printer',
    priority: 'LOW',
    matchScore: 90,
    title: '3rd Floor departmental laser printer paper jam',
    description:
      'Paper tray 2 is reporting paper feed jam error code #E-204. Cleared visible jammed paper but error remains on console.',
    reason: 'Identified office printing peripheral maintenance issue.',
    selfHelp: [
      'Open front service cover and check feed rollers for remaining scraps.',
      'Power cycle printer using rocker switch on lower right panel.',
      'Reroute print jobs to 4th floor backup printer in the meantime.',
    ],
  },
 {
 id: 'vpn',
 label: 'VPN Gateway Timeout',
 shortLabel: 'VPN Timeout',
 category: 'Network',
 priority: 'HIGH',
 matchScore: 98,
 title: 'VPN Gateway timeout when connecting to us-east staging DB',
 description:
 'WireGuard client times out repeatedly at 10.14.0.1 gateway since this morning. Local internet is working, but internal staging database endpoints cannot be reached through the tunnel.',
 reason: 'Detected network gateway & connection routing issues.',
 selfHelp: [
 'Disconnect and reconnect your VPN tunnel or restart the WireGuard client.',
 'Flush your local DNS cache: run `sudo dscacheutil -flushcache` or `ipconfig /flushdns`.',
 'Verify your IP address is within the corporate subnet range (10.x.x.x).',
 ],
 },
 {
 id: 'figma',
 label: 'Figma License Limit',
 shortLabel: 'Figma License',
 category: 'Software',
 priority: 'MEDIUM',
 matchScore: 92,
 title: 'Figma Enterprise seat license expired for design team',
 description:
 'Cannot edit components in the core design system repository due to an enterprise seat allocation limit. Need seat assigned from the reserved design pool for the current sprint.',
 reason: 'Detected software application licensing or runtime crash indicators.',
 selfHelp: [
 'Quit the application completely and relaunch to fetch updated seat token.',
 'Check for pending app updates or reinstall from Enterprise App Catalog.',
 'Verify your account email matches your corporate directory identity.',
 ],
 },
 {
 id: 'battery',
 label: 'MacBook Battery Bulge',
 shortLabel: 'Battery Bulge',
 category: 'Hardware',
 priority: 'CRITICAL',
 matchScore: 96,
 title: 'MacBook Pro battery expanding and trackpad stiff',
 description:
 'Trackpad will not click and bottom aluminum casing is visibly warping outward. Device is running hot and needs immediate battery swap or replacement before safe usage.',
 reason: 'Identified critical physical peripheral or system hardware diagnostic hazard.',
 selfHelp: [
 'Immediately disconnect charger and power down the device to prevent cell rupture.',
 'Do not press down on the swollen trackpad or bottom casing.',
 'Bring device directly to the IT Walk-up Helpdesk (Building 4, Floor 2).',
 ],
 },
]

export default function NewTicketClient({ categories }: { categories: string[] }) {
 const { locale } = useTranslation()
  const [state, action, pending] = useActionState<TicketState, FormData>(createTicket, undefined)
 const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')

  useEffect(() => {
    if (state?.error) {
      toast.error(state.error)
    } else if (state?.fieldErrors) {
      toast.error('Please fix the validation errors before submitting.')
    }
  }, [state])
 const [selectedPriority, setSelectedPriority] = useState('MEDIUM')

 const [aiAnalyzing, setAiAnalyzing] = useState(false)
 const [aiResult, setAiResult] = useState<TriageResult | null>(null)
 const [aiApplied, setAiApplied] = useState(false)
 const [aiDismissed, setAiDismissed] = useState(false)
 const [activeDemoId, setActiveDemoId] = useState<string | null>(null)

 const [dragOver, setDragOver] = useState(false)
 const [attachments, setAttachments] = useState<Attachment[]>([])
 const [uploading, setUploading] = useState(false)
 const fileInputRef = useRef<HTMLInputElement>(null)

 // Real-time quick fix hints while typing
 const livePreview = title.trim().length > 3 ? getSmartFallbackTriage(title, description) : null

 // Apply a demo scenario — still requires user to Accept or Dismiss once loaded
 const applyDemoScenario = (scenario: (typeof DEMO_SCENARIOS)[number]) => {
 setActiveDemoId(scenario.id)
 setTitle(scenario.title)
 setDescription(scenario.description)
 setAiResult({
 category: scenario.category,
 priority: scenario.priority,
 confidence: 'high',
 matchScore: scenario.matchScore,
 reason: scenario.reason,
 selfHelp: scenario.selfHelp,
 })
 // Demo pre-fills the form text but does NOT apply category/priority until Accepted
 setAiApplied(false)
 setAiDismissed(false)
 toast.info(`Demo loaded: ${scenario.shortLabel} — review AI suggestion below`)
 }

 // Clear / Reset form to blank slate
 const handleResetForm = () => {
 setTitle('')
 setDescription('')
 setSelectedCategory('')
 setSelectedPriority('MEDIUM')
 setAiResult(null)
 setAiApplied(false)
 setAiDismissed(false)
 setActiveDemoId(null)
 setAttachments([])
 toast.info('Form cleared back to blank state.')
 }

 // Accept the AI suggestion — apply category/priority to form
 const acceptAiSuggestion = () => {
 if (!aiResult) return
 if (aiResult.category && categories.includes(aiResult.category)) {
 setSelectedCategory(aiResult.category)
 }
 if (aiResult.priority) {
 setSelectedPriority(aiResult.priority)
 }
 setAiApplied(true)
 setAiDismissed(false)
 toast.success(`AI suggestion applied: ${aiResult.category} (${aiResult.priority})`)
 }

 // Dismiss the AI suggestion — leave form as-is
 const dismissAiSuggestion = () => {
 setAiDismissed(true)
 setAiApplied(false)
 toast.info('AI suggestion dismissed. Fill in category and priority manually.')
 }

 // Analyze with Gemini — shows result as a PROPOSAL (not auto-applied)
 const analyzeWithAI = async () => {
 if (!title.trim() && !description.trim()) {
 toast.error('Add a title or description before analyzing.')
 return
 }

 setAiAnalyzing(true)
 setAiApplied(false)
 setAiDismissed(false)

 try {
 const res = await fetch('/api/ai/triage', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ title, description }),
 })

 if (res.ok) {
 const data = await res.json()
 // Show result as proposal — NOT applied yet
 setAiResult(data)
 toast.success('AI analysis complete — review the suggestion below.')
 } else {
 // Graceful smart heuristic fallback if API key not set or failed
 const fallback = getSmartFallbackTriage(title, description)
 setAiResult(fallback)
 toast.success('Heuristic suggestion ready — review below.')
 }
 } catch {
 const fallback = getSmartFallbackTriage(title, description)
 setAiResult(fallback)
 toast.success('Suggestion ready — review below.')
 } finally {
 setAiAnalyzing(false)
 }
 }

 // Upload handler
 const uploadFiles = useCallback(async (files: File[]) => {
 if (!files.length) return
 setUploading(true)

 const formData = new FormData()
 files.forEach((f) => formData.append('files', f))

 try {
 const res = await fetch('/api/upload', { method: 'POST', body: formData })
 const data = await res.json()
 if (!res.ok) throw new Error(data.error ?? 'Upload failed')

 const newAttachments: Attachment[] = await Promise.all(
 (data.attachments as Attachment[]).map(async (att) => {
 if (att.type.startsWith('image/')) {
 const file = files.find((f) => f.name === att.name)
 if (file) {
 const preview = await new Promise<string>((resolve) => {
 const reader = new FileReader()
 reader.onload = (e) => resolve(e.target?.result as string)
 reader.readAsDataURL(file)
 })
 return { ...att, preview }
 }
 }
 return att
 })
 )

 setAttachments((prev) => [...prev, ...newAttachments])
 toast.success(`${files.length} file(s) attached`)
 } catch (err) {
 toast.error(err instanceof Error ? err.message : 'Upload failed')
 } finally {
 setUploading(false)
 }
 }, [])

 const handleDrop = useCallback(
 (e: React.DragEvent) => {
 e.preventDefault()
 setDragOver(false)
 const files = Array.from(e.dataTransfer.files)
 uploadFiles(files)
 },
 [uploadFiles]
 )

 const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
 const files = Array.from(e.target.files ?? [])
 uploadFiles(files)
 }

 const removeAttachment = (index: number) => {
 setAttachments((prev) => prev.filter((_, i) => i !== index))
 }

 // Submit action wrapper
 const handleSubmit = async (formData: FormData) => {
 if (selectedCategory) formData.set('category', selectedCategory)
 if (selectedPriority) formData.set('priority', selectedPriority)
 formData.set(
 'attachmentsJson',
 JSON.stringify(
 attachments.map((a) => ({
 name: a.name,
 size: a.size,
 type: a.type,
 url: a.url,
 }))
 )
 )
 return action(formData)
 }

 const currentSla = SLA_INFO[selectedPriority] || SLA_INFO.MEDIUM
 const activeTriage = aiResult || livePreview

 return (
 <div className="animate-fade-up">
 {/* ───────────────────────────────────────────────────────────
 PAGE HEADER
 ─────────────────────────────────────────────────────────── */}
 <div className="page-header">
 <Link
 href="/tickets"
 className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors mb-3"
 >
 <ArrowLeft className="w-3.5 h-3.5" />
 <span>Back to tickets</span>
 </Link>
 <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
 <div>
 <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
 Create Support Ticket
 </h1>
 <p className="text-base font-normal text-muted-foreground/90 mt-1.5">
 Submit an enterprise incident report or let Gemini Copilot auto-triage category & priority.
 </p>
 </div>
 <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 text-xs font-medium text-indigo-700 dark:text-indigo-800 dark:text-indigo-300 self-start sm:self-auto">
 <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-700 dark:text-indigo-400" />
 <span>AI Copilot Active</span>
 </div>
 </div>
 </div>

 {/* ───────────────────────────────────────────────────────────
 MAIN 2-COLUMN DESKTOP GRID (7-8 COLS FORM / 4-5 COLS COPILOT)
 ─────────────────────────────────────────────────────────── */}
 <div className="page-content">
 <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
 {/* ─────────────────────────────────────────────────────────
 LEFT AREA (lg:col-span-7 xl:col-span-8): MAIN FORM
 ───────────────────────────────────────────────────────── */}
 <div className="lg:col-span-7 xl:col-span-8">
 <div className="rounded-2xl bg-card/70 border border-border p-6 sm:p-7 shadow-sm  backdrop-blur-md relative overflow-hidden">
 {/* Top interior shimmer */}
 <div className="absolute top-0 left-1/4 right-1/4 h-[1px] bg-border pointer-events-none" />

 <form action={handleSubmit} className="space-y-6">
 {/* 0. Always-Accessible Quick Demos Bar */}
 <div className="p-3 rounded-xl bg-background/60 border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
 <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
 <Sparkles className="w-3.5 h-3.5 text-indigo-700 dark:text-indigo-400" />
 <span>Quick Demo Scenarios:</span>
 </div>
 <div className="flex items-center flex-wrap gap-1.5">
 {DEMO_SCENARIOS.map((demo) => {
 const isActive = activeDemoId === demo.id
 return (
 <button
 key={demo.id}
 type="button"
 onClick={() => applyDemoScenario(demo)}
 className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-all duration-150 cursor-pointer ${
 isActive
 ? 'bg-indigo-600 text-foreground border-indigo-400 shadow-sm shadow-indigo-600/40 ring-1 ring-indigo-400/50'
 : 'bg-card border-border text-foreground hover:text-foreground hover:border-border hover:bg-muted'
 }`}
 >
 {isActive ? `✓ ${demo.shortLabel}` : `+ ${demo.shortLabel}`}
 </button>
 )
 })}
 {(title.trim() || description.trim() || activeDemoId) && (
 <button
 type="button"
 onClick={handleResetForm}
 className="text-xs px-2 py-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer flex items-center gap-1 ml-auto sm:ml-0"
 title="Clear form"
 >
 <RotateCcw className="w-3 h-3" />
 <span>Reset</span>
 </button>
 )}
 </div>
 </div>

 {/* 1. Issue Title */}
 <div>
 <div className="flex items-center justify-between mb-1.5">
 <label
 htmlFor="title"
 className="block text-xs font-semibold text-foreground"
 >
 {locale === 'ar' ? 'ملخص المشكلة' : 'Issue Summary'} <span className="text-red-400">*</span>
 </label>
 <span className="text-[11px] text-muted-foreground">
 Be concise and descriptive
 </span>
 </div>
 <input
 id="title"
 name="title"
 type="text"
 required
 value={title}
 onChange={(e) => {
 setTitle(e.target.value)
 if (activeDemoId) setActiveDemoId(null)
 if (aiResult) setAiResult(null)
 }}
 placeholder={locale === 'ar' ? 'مثال: تعذر الاتصال ببوابة VPN للوصول إلى قاعدة البيانات' : 'e.g. VPN Gateway timeout when connecting to us-east staging DB'}
 className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-all duration-200 focus:border-indigo-500/70 focus:ring-2 focus:ring-indigo-500/20 hover:border-border"
 />
 {state?.fieldErrors?.title && (
 <p className="mt-1.5 text-xs text-red-400 flex items-center gap-1">
 <AlertCircle className="w-3.5 h-3.5 shrink-0" />
 {state.fieldErrors.title[0]}
 </p>
 )}
 </div>

 {/* 2. Issue Description */}
 <div>
 <div className="flex items-center justify-between mb-1.5">
 <label
 htmlFor="description"
 className="block text-xs font-semibold text-foreground"
 >
 {locale === 'ar' ? 'الوصف التفصيلي' : 'Detailed Description'} <span className="text-red-400">*</span>
 </label>
 <span className="text-[11px] text-muted-foreground">
 Steps to reproduce, error codes, and impact
 </span>
 </div>
 <textarea
 id="description"
 name="description"
 rows={6}
 required
 value={description}
 onChange={(e) => {
 setDescription(e.target.value)
 if (activeDemoId) setActiveDemoId(null)
 if (aiResult) setAiResult(null)
 }}
 placeholder="Please include:&#10;• What happened and what you expected to happen&#10;• Exact error message or code (if any)&#10;• Affected device, OS version, or service"
 className="w-full bg-background border border-border rounded-xl p-3.5 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-all duration-200 focus:border-indigo-500/70 focus:ring-2 focus:ring-indigo-500/20 hover:border-border resize-none leading-relaxed"
 />
 {state?.fieldErrors?.description && (
 <p className="mt-1.5 text-xs text-red-400 flex items-center gap-1">
 <AlertCircle className="w-3.5 h-3.5 shrink-0" />
 {state.fieldErrors.description[0]}
 </p>
 )}
 </div>

 {/* 3. Embedded Attachments Dropzone (Inside Form Flow) */}
 <div>
 <label className="block text-xs font-semibold text-foreground mb-2">
 Attachments & Diagnostic Logs{' '}
 <span className="text-muted-foreground font-normal">(optional)</span>
 </label>

 <div
 className={`border-1.5 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer ${
 dragOver
 ? 'border-indigo-500 bg-indigo-500/10'
 : 'border-border bg-background/40 hover:border-border hover:bg-background/60'
 }`}
 onDrop={handleDrop}
 onDragOver={(e) => {
 e.preventDefault()
 setDragOver(true)
 }}
 onDragLeave={() => setDragOver(false)}
 onClick={() => fileInputRef.current?.click()}
 >
 <input
 ref={fileInputRef}
 type="file"
 multiple
 className="hidden"
 onChange={handleFileInput}
 accept="image/*,.pdf,.doc,.docx,.txt,.log,.zip"
 />

 {uploading ? (
 <div className="flex items-center justify-center gap-2 py-2">
 <Loader2 className="w-5 h-5 animate-spin text-indigo-700 dark:text-indigo-400" />
 <span className="text-xs font-medium text-foreground">
 Uploading and hashing files…
 </span>
 </div>
 ) : (
 <div className="space-y-1.5">
 <Upload className="w-6 h-6 mx-auto text-muted-foreground" />
 <p className="text-xs font-medium text-foreground">
 Drag and drop files here, or{' '}
 <span className="text-indigo-700 dark:text-indigo-400 underline underline-offset-2">
 browse from computer
 </span>
 </p>
 <p className="text-[11px] text-muted-foreground">
 Supports Screenshots, Crash Dumps, Logs, and PDFs up to 10MB
 </p>
 </div>
 )}
 </div>

 {/* Attachment Thumbnails & Files List */}
 {attachments.length > 0 && (
 <div className="mt-3 space-y-2">
 {attachments.map((att, i) => (
 <div
 key={i}
 className="flex items-center gap-3 p-2.5 rounded-xl bg-background/80 border border-border"
 >
 {att.preview ? (
 // eslint-disable-next-line @next/next/no-img-element -- local blob: preview, next/image can't optimize it
 <img
 src={att.preview}
 alt={att.name}
 className="w-10 h-10 rounded-lg object-cover shrink-0 border border-border"
 />
 ) : (
 <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0 text-muted-foreground">
 <FileText className="w-5 h-5 text-muted-foreground" />
 </div>
 )}

 <div className="flex-1 min-w-0">
 <p className="text-xs font-medium text-foreground truncate">
 {att.name}
 </p>
 <p className="text-[11px] text-muted-foreground">
 {formatBytes(att.size)}
 </p>
 </div>

 <button
 type="button"
 onClick={() => removeAttachment(i)}
 className="p-1 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-muted transition-colors"
 title="Remove attachment"
 >
 <X className="w-4 h-4" />
 </button>
 </div>
 ))}
 </div>
 )}
 </div>

 {/* 4. Category & Priority Dropdowns in a 2-Column Grid */}
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
 <div>
 <div className="flex items-center justify-between mb-1.5">
 <label
 htmlFor="category"
 className="block text-xs font-semibold text-foreground"
 >
 Category <span className="text-red-400">*</span>
 </label>
 {aiApplied && (
 <span className="text-[10px] text-indigo-700 dark:text-indigo-400 font-medium flex items-center gap-1">
 <Check className="w-3 h-3" /> Auto-filled
 </span>
 )}
 </div>
 <div className="relative">
 <select
 id="category"
 name="category"
 required
 value={selectedCategory}
 onChange={(e) => {
 setSelectedCategory(e.target.value)
 if (activeDemoId) setActiveDemoId(null)
 }}
 className="w-full appearance-none pe-10 ps-3 bg-background border border-border rounded-xl px-3 py-2.5 text-xs text-foreground dark:text-foreground outline-none transition-all duration-200 focus:border-indigo-500/70 focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
 >
 <option value="">{locale === 'ar' ? 'اختر فئة التذكرة...' : 'Select ticket category…'}</option>
 {categories.map((c) => (
 <option key={c} value={c}>
 {c}
 </option>
 ))}
 </select>
 <ChevronDown className="absolute end-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
 </div>
 {state?.fieldErrors?.category && (
 <p className="mt-1.5 text-xs text-red-400 flex items-center gap-1">
 <AlertCircle className="w-3.5 h-3.5 shrink-0" />
 {state.fieldErrors.category[0]}
 </p>
 )}
 </div>

 <div>
 <label
 htmlFor="priority"
 className="block text-xs font-semibold text-foreground mb-1.5"
 >
 Impact & Urgency
 </label>
 <div className="relative">
 <select
 id="priority"
 name="priority"
 value={selectedPriority}
 onChange={(e) => {
 setSelectedPriority(e.target.value)
 if (activeDemoId) setActiveDemoId(null)
 }}
 className="w-full appearance-none pe-10 ps-3 bg-background border border-border rounded-xl px-3 py-2.5 text-xs text-foreground dark:text-foreground outline-none transition-all duration-200 focus:border-indigo-500/70 focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
 >
 <option value="LOW">{locale === 'ar' ? 'منخفضة — استفسار غير عاجل' : 'Low — Non-urgent inquiry'}</option>
 <option value="MEDIUM">{locale === 'ar' ? 'متوسطة — تأثير تشغيلي عادي' : 'Medium — Normal operational impact'}</option>
 <option value="HIGH">{locale === 'ar' ? 'مرتفعة — تعطل سير العمل بشكل ملحوظ' : 'High — Significant workflow blocker'}</option>
 <option value="CRITICAL">{locale === 'ar' ? 'حرجة — انقطاع كامل للخدمة' : 'Critical — Complete service downtime'}</option>
 </select>
 <ChevronDown className="absolute end-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
 </div>
 </div>
 </div>

 {/* Hidden field for attachments */}
 <input
 type="hidden"
 name="attachmentsJson"
 value={JSON.stringify(
 attachments.map((a) => ({
 name: a.name,
 size: a.size,
 type: a.type,
 url: a.url,
 }))
 )}
 />

  <div className="flex items-center gap-2 mb-4 mt-2">
  <input
  type="checkbox"
  id="autoAssign"
  name="autoAssign"
  value="true"
  defaultChecked={true}
  className="w-4 h-4 rounded border-border bg-background text-indigo-600 focus:ring-indigo-500 cursor-pointer"
  />
  <label htmlFor="autoAssign" className="text-xs text-foreground cursor-pointer font-medium">
  Auto-assign ticket to available IT agent based on skill
  </label>
  </div>

  {/* Form General Error Alert */}
 {state?.error && (
 <div className="flex items-center gap-2.5 p-3 rounded-xl bg-red-500/10 border border-red-500/25 text-red-300 text-xs">
 <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
 <span>{state.error}</span>
 </div>
 )}

 {/* 5. Form Actions at the Bottom */}
 <div className="flex items-center gap-3 pt-4 border-t border-border">
 <button
 type="submit"
 disabled={pending}
 className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 py-2.5 px-6 rounded-xl text-sm font-semibold text-foreground bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
 >
 {pending ? (
 <>
 <Loader2 className="w-4 h-4 animate-spin" />
 <span>{locale === 'ar' ? 'جاري الإرسال...' : 'Submitting Ticket…'}</span>
 </>
 ) : (
 <>
 <span>{locale === 'ar' ? 'إرسال التذكرة' : 'Submit Ticket'}</span>
 <ArrowLeft className="w-4 h-4 rotate-180 rtl:rotate-0" />
 </>
 )}
 </button>

 <Link
 href="/tickets"
 className="btn btn-secondary text-xs"
 >
 Cancel
 </Link>

 {(title.trim() || description.trim() || attachments.length > 0 || selectedCategory || activeDemoId) && (
 <button
 type="button"
 onClick={handleResetForm}
 className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-colors cursor-pointer ml-auto"
 title="Clear all fields"
 >
 <RotateCcw className="w-3.5 h-3.5" />
 <span>{locale === 'ar' ? 'إعادة تعيين' : 'Reset Form'}</span>
 </button>
 )}
 </div>
 </form>
 </div>
 </div>

 {/* ─────────────────────────────────────────────────────────
 RIGHT AREA (lg:col-span-5 xl:col-span-4): AI COPILOT PANEL
 ───────────────────────────────────────────────────────── */}
 <div className="lg:col-span-5 xl:col-span-4 space-y-5 lg:sticky lg:top-8">
 <div className="rounded-2xl bg-card border border-border p-5 sm:p-6 shadow-md  backdrop-blur-md relative overflow-hidden space-y-5">
 {/* Ambient purple/indigo radial glow in background */}
 <div
 className="absolute -top-12 -right-12 w-80 h-80 rounded-full pointer-events-none"
 style={{
 background:
 'radial-gradient(circle, rgba(99, 102, 241, 0.25) 0%, rgba(139, 92, 246, 0.12) 45%, transparent 70%)',
 filter: 'blur(50px)',
 }}
 />

 {/* Top Copilot Header with Live Sparkle / Wand Badge */}
 <div className="flex items-center justify-between pb-3.5 border-b border-border relative z-10">
 <div className="flex items-center gap-2.5">
 <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center text-foreground shadow-md shadow-indigo-500/30">
 <Sparkles className="w-4 h-4 animate-pulse" />
 </div>
 <div>
 <h3 className="text-sm font-bold text-foreground tracking-tight flex items-center gap-1.5">
 Gemini Smart Copilot
 </h3>
 <p className="text-[11px] text-muted-foreground">
 Live AI Triage & Self-Service
 </p>
 </div>
 </div>

 <div className="flex items-center gap-1.5">
 <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-[10px] font-mono font-semibold text-indigo-800 dark:text-indigo-300 shadow-sm">
 <Wand2 className="w-3 h-3 text-indigo-700 dark:text-indigo-400" />
 2.0 Flash
 </span>

 {(title.trim() || description.trim() || selectedCategory || activeDemoId) && (
 <button
 type="button"
 onClick={handleResetForm}
 className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-background/10 transition-colors cursor-pointer"
 title="Reset Form"
 >
 <RotateCcw className="w-3.5 h-3.5" />
 </button>
 )}
 </div>
 </div>

 {/* Always-Accessible Quick Demos Bar */}
 <div className="space-y-1.5 relative z-10">
 <div className="flex items-center justify-between">
 <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
 <Sparkles className="w-3 h-3 text-indigo-700 dark:text-indigo-400" />
 Quick Incident Scenarios
 </span>
 {activeDemoId ? (
 <span className="text-[10px] text-indigo-700 dark:text-indigo-400 font-mono flex items-center gap-1">
 <Check className="w-3 h-3" /> Active Demo
 </span>
 ) : (
 <span className="text-[10px] text-muted-foreground font-mono">1-Click Test</span>
 )}
 </div>

 <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
 {DEMO_SCENARIOS.map((demo) => {
 const isActive = activeDemoId === demo.id
 return (
 <button
 key={demo.id}
 type="button"
 onClick={() => applyDemoScenario(demo)}
 className={`px-2.5 py-2 rounded-xl text-left border text-xs transition-all duration-150 cursor-pointer flex flex-col justify-between group ${
 isActive
 ? 'bg-indigo-600/25 border-indigo-500/80 text-foreground shadow-md  ring-1 ring-indigo-500/40'
 : 'bg-background/60 border-border text-foreground hover:bg-card hover:border-border hover:text-foreground'
 }`}
 >
 <span className="font-semibold text-[11px] truncate block leading-tight">
 {demo.shortLabel}
 </span>
 <span className="text-[9px] text-muted-foreground font-mono mt-1 truncate block flex items-center justify-between">
 <span>{demo.category}</span>
 {isActive && <Check className="w-2.5 h-2.5 text-emerald-800 dark:text-emerald-300 dark:text-emerald-400" />}
 </span>
 </button>
 )
 })}
 </div>
 </div>

 {/* Prominent AI Triage Trigger Button */}
 <div className="relative z-10">
 <button
 type="button"
 onClick={analyzeWithAI}
 disabled={aiAnalyzing || (!title.trim() && !description.trim())}
 className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-semibold text-foreground bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm transition-colors border-transparent disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150 cursor-pointer active:scale-[0.99]"
 >
 {aiAnalyzing ? (
 <>
 <Loader2 className="w-4 h-4 animate-spin text-foreground" />
 <span>Analyzing ticket semantics…</span>
 </>
 ) : (
 <>
 <Wand2 className="w-4 h-4 text-indigo-200" />
 <span>Analyze with Gemini</span>
 </>
 )}
 </button>
 <p className="text-[11px] text-muted-foreground text-center mt-1.5">
 Predicts category, priority & suggests immediate quick fixes
 </p>
 </div>

 {/* Empty / Initial State for Copilot (When no text or demo has been selected) */}
 {!activeTriage && (
 <div className="rounded-xl bg-background border border-border p-4 text-center space-y-2.5 relative z-10">
 <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 text-indigo-600 dark:text-indigo-700 dark:text-indigo-400 flex items-center justify-center mx-auto shadow-inner">
 <Bot className="w-4 h-4" />
 </div>
 <div>
 <h4 className="text-xs font-semibold text-foreground">
 AI Triage Ready
 </h4>
 <p className="text-[11px] text-muted-foreground mt-1 max-w-[240px] mx-auto leading-relaxed">
 Select a demo scenario above or start typing an issue summary to preview live triage & self-service fixes.
 </p>
 </div>
 </div>
 )}

 {/* Live Prediction Card */}
 {activeTriage && (
 <div className="rounded-xl bg-indigo-950/30 border border-indigo-500/30 p-4 space-y-3 relative z-10 animate-fade-in shadow-[inset_0_1px_0_0_rgba(99,102,241,0.2)]">
 <div className="flex items-center justify-between">
 <span className="text-[11px] uppercase tracking-wider font-semibold text-indigo-800 dark:text-indigo-300">
 Live Prediction
 </span>
 {/* Confidence chip: e.g. Network • 98% match */}
 <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 dark:bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 dark:text-emerald-800 dark:text-emerald-300 border border-emerald-500/30 font-medium inline-flex items-center gap-1.5 shadow-sm">
 <span className="w-1.5 h-1.5 rounded-full bg-emerald-100 dark:bg-emerald-950 animate-pulse" />
 {activeTriage.category} • {activeTriage.matchScore ?? 98}% match
 </span>
 </div>

 <div className="grid grid-cols-2 gap-2 text-xs">
 <div className="p-2.5 rounded-xl bg-background border border-border flex flex-col justify-between">
 <span className="text-[11px] text-muted-foreground block mb-1">
 Detected Category
 </span>
 <span className="font-semibold text-foreground flex items-center gap-1.5">
 <CheckCircle2 className="w-3.5 h-3.5 text-emerald-800 dark:text-emerald-300 dark:text-emerald-800 dark:text-emerald-300 shrink-0" />
 <span className="truncate">{activeTriage.category}</span>
 </span>
 </div>
 <div className="p-2.5 rounded-xl bg-background border border-border flex flex-col justify-between">
 <span className="text-[11px] text-muted-foreground block mb-1">
 Suggested Priority
 </span>
 <span className="font-semibold text-foreground flex items-center gap-1.5">
 <ShieldAlert className="w-3.5 h-3.5 text-indigo-700 dark:text-indigo-400 shrink-0" />
 <span>{activeTriage.priority}</span>
 </span>
 </div>
 </div>

 {activeTriage.reason && (
 <p className="text-[11px] text-muted-foreground leading-relaxed italic bg-background/40 p-2 rounded-lg border border-border">
 &quot;{activeTriage.reason}&quot;
 </p>
 )}
 </div>
 )}

 {/* Instant Self-Help Widget */}
 {activeTriage && activeTriage.selfHelp.length > 0 && (
 <div className="rounded-xl bg-background/60 border border-border p-4 space-y-3 relative z-10 shadow-sm">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-300">
 <Lightbulb className="w-3.5 h-3.5 text-amber-400 shrink-0" />
 <span>Possible Quick Fixes Before You Submit</span>
 </div>
 <span className="text-[10px] text-muted-foreground font-mono">
 Self-Service
 </span>
 </div>
 <p className="text-[11px] text-muted-foreground leading-relaxed">
 Try these steps now — you may resolve the incident without waiting for an IT technician:
 </p>

 <ol className="space-y-2 text-xs text-foreground">
 {activeTriage.selfHelp.map((step, idx) => (
 <li key={idx} className="flex items-start gap-2.5 bg-card/50 p-2 rounded-lg border border-border">
 <span className="w-4 h-4 rounded bg-indigo-500/20 text-indigo-800 dark:text-indigo-300 flex items-center justify-center font-mono text-[10px] shrink-0 font-bold mt-0.5">
 {idx + 1}
 </span>
 <span className="text-[11px] leading-snug text-foreground">{step}</span>
 </li>
 ))}
 </ol>
 </div>
 )}

 {/* ── AI PROPOSAL: Explicit Accept / Dismiss buttons ── */}
 {aiResult && !aiDismissed && (
 <div
 className="rounded-xl p-4 space-y-3 relative z-10 animate-fade-in"
 style={{
 background: aiApplied ? 'rgba(34,197,94,0.06)' : 'rgba(99,102,241,0.08)',
 border: aiApplied ? '1px solid rgba(34,197,94,0.3)' : '1px solid rgba(99,102,241,0.35)',
 }}
 >
 {aiApplied ? (
 <div className="flex items-center gap-2.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300 dark:text-emerald-400">
 <CheckCircle2 className="w-4 h-4" />
 <span>AI suggestion applied ✓</span>
 <button
 type="button"
 onClick={() => { setAiApplied(false); setAiResult(null); setSelectedCategory(''); setSelectedPriority('MEDIUM') }}
 className="ml-auto text-[10px] px-2 py-0.5 rounded-lg bg-muted border border-border text-muted-foreground hover:text-foreground cursor-pointer font-normal"
 >
 Undo
 </button>
 </div>
 ) : (
 <>
 <div className="text-xs font-semibold text-indigo-800 dark:text-indigo-300 flex items-center gap-2">
 <Sparkles className="w-3.5 h-3.5 text-indigo-700 dark:text-indigo-400 animate-pulse" />
 AI Proposal — apply to form?
 </div>
 <p className="text-[11px] text-muted-foreground">
 Category: <span className="text-foreground font-medium">{aiResult.category}</span>
 {' · '}
 Priority: <span className="text-foreground font-medium">{aiResult.priority}</span>
 </p>
 <div className="flex gap-2">
 <button
 id="accept-ai-suggestion"
 type="button"
 onClick={acceptAiSuggestion}
 className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold text-foreground bg-indigo-600 hover:bg-indigo-500 border border-indigo-400/40 cursor-pointer"
 >
 <CheckCircle2 className="w-3.5 h-3.5" />
 Accept Suggestion
 </button>
 <button
 id="dismiss-ai-suggestion"
 type="button"
 onClick={dismissAiSuggestion}
 className="px-3 py-2 rounded-xl text-xs font-medium text-muted-foreground hover:text-foreground bg-muted border border-border cursor-pointer"
 >
 <X className="w-3.5 h-3.5" />
 </button>
 </div>
 </>
 )}
 </div>
 )}

 {aiResult && aiDismissed && (
 <div className="rounded-xl p-3 text-center relative z-10 border border-border bg-background/40">
 <p className="text-[11px] text-muted-foreground">
 Dismissed.{' '}
 <button type="button" onClick={() => setAiDismissed(false)} className="text-indigo-700 dark:text-indigo-400 hover:text-indigo-800 dark:text-indigo-300 underline cursor-pointer">
 View again
 </button>
 </p>
 </div>
 )}

 {/* Estimated Response Time SLA Card */}
 <div className="rounded-xl bg-background/60 border border-border p-3.5 relative z-10">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-2">
 <Clock className="w-3.5 h-3.5 text-muted-foreground" />
 <span className="text-xs font-semibold text-foreground">
 Estimated Response Time SLA
 </span>
 </div>
 <span
 className={`text-[10px] font-mono px-2 py-0.5 rounded-full border font-semibold ${currentSla.badgeClass}`}
 >
 {selectedPriority}
 </span>
 </div>
 <div className="mt-2 text-xs flex items-baseline justify-between">
 <div>
 <p className="font-semibold text-foreground">{currentSla.time}</p>
 <p className="text-[11px] text-muted-foreground mt-0.5">
 {currentSla.label}
 </p>
 </div>
 </div>
 </div>
 </div>
 </div>
 </div>
 </div>
 </div>
 )
}

