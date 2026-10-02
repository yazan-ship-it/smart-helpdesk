'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { updateSettings, updateAgentSkills } from '@/app/actions/settings'
import { Loader2, Save, Layout, Clock, FolderGit2, Sparkles, MessageSquare, Plus, Trash2, X, UserCog } from 'lucide-react'
import type { AppSettings } from '@prisma/client'
import { useTranslation, getPriorityLabel } from '@/lib/i18n'
import { parseSkills } from '@/lib/skills'

type Agent = {
  id: string
  name: string
  email: string
  skills: string | null
}

type Props = {
  initialSettings: AppSettings | null
  agents: Agent[]
}

const TABS = [
  { id: 'general', label: 'General & Security', icon: Layout },
  { id: 'sla', label: 'SLA Policies & Business Hours', icon: Clock },
  { id: 'routing', label: 'Categories & Agent Skills Matrix', icon: FolderGit2 },
  { id: 'ai', label: 'AI & Copilot', icon: Sparkles },
  { id: 'canned', label: 'Canned Responses Manager', icon: MessageSquare },
]


const TAB_LABELS: Record<string, { en: string; ar: string }> = {
  general: { en: 'General & Security', ar: 'عام والأمان' },
  sla: { en: 'SLA Policies & Business Hours', ar: 'سياسات SLA وساعات العمل' },
  routing: { en: 'Categories & Agent Skills Matrix', ar: 'التصنيفات ومصفوفة مهارات الوكلاء' },
  ai: { en: 'AI & Copilot', ar: 'الذكاء الاصطناعي والمساعد الذكي' },
  canned: { en: 'Canned Responses Manager', ar: 'إدارة الردود الجاهزة' },
}


const DAYS_TRANSLATIONS: Record<string, string> = {
  Sunday: 'الأحد',
  Monday: 'الإثنين',
  Tuesday: 'الثلاثاء',
  Wednesday: 'الأربعاء',
  Thursday: 'الخميس',
  Friday: 'الجمعة',
  Saturday: 'السبت'
};
const DAYS_OF_WEEK = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

export default function SettingsClient({ initialSettings, agents }: Props) {
  const { locale } = useTranslation()
  const [isPending, startTransition] = useTransition()
  const [activeTab, setActiveTab] = useState('general')

  // Local state for agents to allow toggling skills before saving
  const [localAgents, setLocalAgents] = useState(
    agents.map(a => ({
      ...a,
      parsedSkills: parseSkills(a.skills)
    }))
  )

  const [formData, setFormData] = useState({
    appName: initialSettings?.appName ?? 'Smart Helpdesk',
    supportEmail: initialSettings?.supportEmail ?? 'support@company.com',
    defaultPriority: initialSettings?.defaultPriority ?? 'MEDIUM',
    autoAssignmentEnabled: initialSettings?.autoAssignmentEnabled ?? true,
    
    slaCriticalHours: initialSettings?.slaCriticalHours ?? 4,
    slaHighHours: initialSettings?.slaHighHours ?? 24,
    slaMediumHours: initialSettings?.slaMediumHours ?? 48,
    slaLowHours: initialSettings?.slaLowHours ?? 72,
    businessHoursStart: initialSettings?.businessHoursStart ?? '09:00',
    businessHoursEnd: initialSettings?.businessHoursEnd ?? '17:00',
    workDays: initialSettings?.workDays ? JSON.parse(initialSettings.workDays) as string[] : ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    pauseSlaOnWeekends: initialSettings?.pauseSlaOnWeekends ?? true,
    
    enableAiTriage: initialSettings?.enableAiTriage ?? true,
    fallbackHeuristicsEnabled: initialSettings?.fallbackHeuristicsEnabled ?? true,
    
    autoApproveDomain: initialSettings?.autoApproveDomain ?? '@company.com',
    maintenanceMode: initialSettings?.maintenanceMode ?? false,
    
    categoriesList: (() => {
      const parsed = initialSettings?.categoriesList ? JSON.parse(initialSettings.categoriesList) as string[] : [];
      return parsed.length <= 2 
        ? ["Hardware", "Software", "Network", "Email & Communication", "Access & Permissions", "Printer", "Security", "Other"]
        : parsed;
    })(),
    cannedResponses: (() => {
      const parsed = initialSettings?.cannedResponses ? JSON.parse(initialSettings.cannedResponses) as { id: string, title: string, content: string }[] : [];
      return parsed.length === 0
        ? [
            {
              id: "1",
              title: "Password Reset Instructions",
              content: "Your password has been reset. Temporary credentials have been sent via secure SMS/email."
            },
            {
              id: "2",
              title: "Request Computer Asset Tag",
              content: "Please reply with your device Asset Tag number located on the barcode label on the underside of your laptop."
            },
            {
              id: "3",
              title: "Network Cache Flush",
              content: "Please disconnect from the VPN, restart your router, and reconnect to verify if the issue persists."
            }
          ]
        : parsed;
    })()
  })

  const [newCategory, setNewCategory] = useState('')
  const [newResponse, setNewResponse] = useState({ title: '', content: '' })
  const [isResponseModalOpen, setIsResponseModalOpen] = useState(false)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked
      setFormData(prev => ({ ...prev, [name]: checked }))
    } else if (type === 'number') {
      setFormData(prev => ({ ...prev, [name]: Number(value) }))
    } else {
      setFormData(prev => ({ ...prev, [name]: value }))
    }
  }

  const handleDayToggle = (day: string) => {
    setFormData(prev => {
      const newDays = prev.workDays.includes(day)
        ? prev.workDays.filter(d => d !== day)
        : [...prev.workDays, day]
      return { ...prev, workDays: newDays }
    })
  }

  const handleAddCategory = () => {
    if (!newCategory.trim()) return
    if (formData.categoriesList.includes(newCategory.trim())) {
      toast.error('Category already exists')
      return
    }
    setFormData(prev => ({ ...prev, categoriesList: [...prev.categoriesList, newCategory.trim()] }))
    setNewCategory('')
  }

  const handleRemoveCategory = (cat: string) => {
    setFormData(prev => ({ ...prev, categoriesList: prev.categoriesList.filter(c => c !== cat) }))
  }

  const handleAddResponse = () => {
    if (!newResponse.title.trim() || !newResponse.content.trim()) {
      toast.error('Title and content are required')
      return
    }
    setFormData(prev => ({
      ...prev,
      cannedResponses: [...prev.cannedResponses, { id: Date.now().toString(), title: newResponse.title, content: newResponse.content }]
    }))
    setNewResponse({ title: '', content: '' })
    setIsResponseModalOpen(false)
  }

  const handleRemoveResponse = (id: string) => {
    setFormData(prev => ({ ...prev, cannedResponses: prev.cannedResponses.filter(r => r.id !== id) }))
  }

  const handleSave = () => {
    if (!formData.appName.trim()) {
      toast.error('App Name is required')
      return
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!formData.supportEmail || !emailRegex.test(formData.supportEmail)) {
      toast.error('Valid Support Email is required')
      return
    }
    if (formData.slaCriticalHours <= 0 || formData.slaHighHours <= 0 || formData.slaMediumHours <= 0 || formData.slaLowHours <= 0) {
      toast.error('SLA hours must be positive numbers')
      return
    }
    if (formData.workDays.length === 0) {
      toast.error('At least one working day must be selected')
      return
    }
    if (formData.categoriesList.length === 0) {
      toast.error('At least one category must be defined')
      return
    }

    const payload = {
      ...formData,
      workDays: JSON.stringify(formData.workDays),
      categoriesList: JSON.stringify(formData.categoriesList),
      cannedResponses: JSON.stringify(formData.cannedResponses)
    }

    startTransition(async () => {
      try {
        const result = await updateSettings(payload)
        if (result.error) {
          toast.error(result.error)
          return
        }
        
        // Save agent skills
        for (const agent of localAgents) {
          const originalAgent = agents.find(a => a.id === agent.id)
          const originalSkills = parseSkills(originalAgent?.skills)
          // Only update if changed
          if (JSON.stringify(originalSkills) !== JSON.stringify(agent.parsedSkills)) {
            await updateAgentSkills(agent.id, agent.parsedSkills)
          }
        }

        toast.success('Settings updated successfully')
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to update settings')
      }
    })
  }

  return (
    <div className="flex flex-col lg:flex-row gap-8">
      
      {/* Sidebar Tabs */}
      <div className="w-full lg:w-64 shrink-0 space-y-1">
        {TABS.map(tab => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                isActive 
                  ? 'bg-primary/10 text-primary' 
                  : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
              }`}
            >
              <Icon className="w-4 h-4" />
              {locale === 'ar' ? TAB_LABELS[tab.id]?.ar || tab.label : tab.label}
            </button>
          )
        })}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 max-w-4xl space-y-6">
        
        {activeTab === 'general' && (
          <section className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl overflow-hidden shadow-sm">
            <div className="border-b border-[var(--border)] px-6 py-4 bg-muted/10">
              <h2 className="text-lg font-bold text-foreground">{locale === 'ar' ? 'عام والأمان' : 'General & Security'}</h2>
              <p className="text-sm text-muted-foreground mt-0.5">{locale === 'ar' ? 'الإعدادات الأساسية للتطبيق والأمان.' : 'Basic application configuration and security.'}</p>
            </div>
            <div className="p-6 space-y-6">
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-foreground">{locale === 'ar' ? 'اسم التطبيق' : 'App Name'}</label>
                <input
                  type="text"
                  name="appName"
                  value={formData.appName}
                  onChange={handleChange}
                  className="w-full px-3 py-2 bg-[var(--bg-base)] border border-[var(--border)] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-foreground">{locale === 'ar' ? 'البريد الإلكتروني للدعم' : 'Support Email'}</label>
                <input
                  type="email"
                  name="supportEmail"
                  value={formData.supportEmail}
                  onChange={handleChange}
                  className="w-full px-3 py-2 bg-[var(--bg-base)] border border-[var(--border)] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-foreground">{locale === 'ar' ? 'نطاق الموافقة التلقائية' : 'Auto-Approve Domain'}</label>
                <input
                  type="text"
                  name="autoApproveDomain"
                  value={formData.autoApproveDomain}
                  onChange={handleChange}
                  placeholder="@company.com"
                  className="w-full px-3 py-2 bg-[var(--bg-base)] border border-[var(--border)] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
                />
                <p className="text-xs text-muted-foreground">{locale === 'ar' ? 'المستخدمون المسجلون بهذا النطاق سيتم اعتمادهم تلقائياً.' : 'Users registering with this email domain will be automatically approved.'}</p>
              </div>
              <div className="flex items-center justify-between p-4 bg-muted/20 border border-border rounded-xl">
                <div className="space-y-0.5">
                  <p className="text-sm font-semibold text-foreground">{locale === 'ar' ? 'وضع الصيانة' : 'Maintenance Mode'}</p>
                  <p className="text-xs text-muted-foreground">{locale === 'ar' ? 'تعطيل تسجيل الدخول لغير المشرفين.' : 'Disable new logins for non-admins.'}</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" name="maintenanceMode" checked={formData.maintenanceMode} onChange={handleChange} className="sr-only peer" />
                  <div className="w-9 h-5 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>
            </div>
          </section>
        )}

        {activeTab === 'sla' && (
          <section className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl overflow-hidden shadow-sm">
            <div className="border-b border-[var(--border)] px-6 py-4 bg-muted/10">
              <h2 className="text-lg font-bold text-foreground">{locale === 'ar' ? 'سياسات SLA وساعات العمل' : 'SLA Policies & Business Hours'}</h2>
              <p className="text-sm text-muted-foreground mt-0.5">{locale === 'ar' ? 'تحديد أوقات الاستجابة المستهدفة وساعات العمل التشغيلية.' : 'Configure target response times and operational hours.'}</p>
            </div>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {['Critical', 'High', 'Medium', 'Low'].map((level) => (
                  <div key={level} className="space-y-1.5">
                    <label className="text-sm font-semibold text-foreground">{getPriorityLabel(level, locale)} ({locale === 'ar' ? 'ساعات' : 'hrs'})</label>
                    <input
                      type="number"
                      name={`sla${level}Hours`}
                      value={formData[`sla${level}Hours` as keyof typeof formData] as number}
                      onChange={handleChange}
                      className="w-full px-3 py-2 bg-[var(--bg-base)] border border-[var(--border)] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
                    />
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-foreground">{locale === 'ar' ? 'بداية ساعات العمل' : 'Business Hours Start'}</label>
                  <input
                    type="time"
                    name="businessHoursStart"
                    value={formData.businessHoursStart}
                    onChange={handleChange}
                    className="w-full px-3 py-2 bg-[var(--bg-base)] border border-[var(--border)] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-foreground">{locale === 'ar' ? 'نهاية ساعات العمل' : 'Business Hours End'}</label>
                  <input
                    type="time"
                    name="businessHoursEnd"
                    value={formData.businessHoursEnd}
                    onChange={handleChange}
                    className="w-full px-3 py-2 bg-[var(--bg-base)] border border-[var(--border)] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-semibold text-foreground">{locale === 'ar' ? 'أيام العمل الرسمية' : 'Working Days'}</label>
                <div className="flex flex-wrap gap-2">
                  {DAYS_OF_WEEK.map(day => (
                    <button
                      key={day}
                      onClick={() => handleDayToggle(day)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                        formData.workDays.includes(day)
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-[var(--bg-base)] text-muted-foreground border-border hover:border-primary/50'
                      }`}
                    >
                      {locale === 'ar' ? DAYS_TRANSLATIONS[day] : day.substring(0, 3)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-muted/20 border border-border rounded-xl">
                <div className="space-y-0.5">
                  <p className="text-sm font-semibold text-foreground">{locale === 'ar' ? 'إيقاف SLA مؤقتاً في عطلة نهاية الأسبوع' : 'Pause SLA on Weekends'}</p>
                  <p className="text-xs text-muted-foreground">{locale === 'ar' ? 'تجميد عدادات اتفاقية مستوى الخدمة خارج أيام العمل الرسمية.' : 'SLA timers will freeze outside of working days.'}</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" name="pauseSlaOnWeekends" checked={formData.pauseSlaOnWeekends} onChange={handleChange} className="sr-only peer" />
                  <div className="w-9 h-5 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>
            </div>
          </section>
        )}

        {activeTab === 'routing' && (
          <>
            <section className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl overflow-hidden shadow-sm">
            <div className="border-b border-[var(--border)] px-6 py-4 bg-muted/10">
              <h2 className="text-lg font-bold text-foreground">{locale === 'ar' ? 'التصنيفات ومصفوفة مهارات الوكلاء' : 'Categories & Agent Skills Matrix'}</h2>
              <p className="text-sm text-muted-foreground mt-0.5">{locale === 'ar' ? 'إدارة تصنيفات التذاكر وقواعد التوزيع والمهارات.' : 'Manage ticket categories and assignment rules.'}</p>
            </div>
            <div className="p-6 space-y-6">
              
              <div className="space-y-3">
                <label className="text-sm font-semibold text-foreground">{locale === 'ar' ? 'تصنيفات التذاكر' : 'Ticket Categories'}</label>
                <div className="flex flex-wrap gap-2">
                  {formData.categoriesList.map(cat => (
                    <div key={cat} className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary text-secondary-foreground text-sm font-medium border border-border">
                      {cat}
                      <button onClick={() => handleRemoveCategory(cat)} className="text-muted-foreground hover:text-destructive">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <input
                    type="text"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    placeholder={locale === 'ar' ? 'اسم التصنيف الجديد' : 'New category name'}
                    className="flex-1 px-3 py-2 bg-[var(--bg-base)] border border-[var(--border)] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleAddCategory()
                      }
                    }}
                  />
                  <button onClick={handleAddCategory} className="btn btn-secondary px-4 py-2 h-auto text-sm">{locale === 'ar' ? 'إضافة' : 'Add'}</button>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-muted/20 border border-border rounded-xl">
                <div className="space-y-0.5">
                  <p className="text-sm font-semibold text-foreground">{locale === 'ar' ? 'التوزيع الآلي الشامل' : 'Global Auto-Assignment'}</p>
                  <p className="text-xs text-muted-foreground">{locale === 'ar' ? 'توزيع التذاكر الجديدة تلقائياً على الوكلاء حسب التصنيفات والمهارات' : 'Automatically route new tickets to agents based on categories/skills.'}</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" name="autoAssignmentEnabled" checked={formData.autoAssignmentEnabled} onChange={handleChange} className="sr-only peer" />
                  <div className="w-9 h-5 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>

            </div>
          </section>
          
          {/* Agent Skills Manager */}
          <section className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl overflow-hidden shadow-sm mt-6">
            <div className="border-b border-[var(--border)] px-6 py-4 bg-muted/10">
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                <UserCog className="w-5 h-5 text-indigo-500" />
                {locale === 'ar' ? 'مصفوفة مهارات الوكلاء' : 'Assigned Manager'}
              </h2>
              <p className="text-sm text-muted-foreground mt-0.5">{locale === 'ar' ? 'تعيين تصنيفات محددة لأخصائيي الدعم الفني لتوجيه البلاغات تلقائياً.' : 'Assign specific categories to your IT Support agents for routing.'}</p>
            </div>
            <div className="divide-y divide-border">
              {localAgents.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">{locale === 'ar' ? 'لم يتم العثور على أخصائيي دعم فني.' : 'No IT Support agents found.'}</div>
              ) : (
                localAgents.map(agent => (
                  <div key={agent.id} className="p-6 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-sm text-foreground">{agent.name}</p>
                        <p className="text-xs text-muted-foreground">{agent.email}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 pt-2">
                      {formData.categoriesList.map(cat => {
                        const hasSkill = agent.parsedSkills.includes(cat)
                        return (
                          <button
                            type="button"
                            key={cat}
                            onClick={() => {
                              setLocalAgents(prev => prev.map(a => {
                                if (a.id === agent.id) {
                                  return {
                                    ...a,
                                    parsedSkills: hasSkill 
                                      ? a.parsedSkills.filter(s => s !== cat)
                                      : [...a.parsedSkills, cat]
                                  }
                                }
                                return a
                              }))
                            }}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                              hasSkill
                                ? 'bg-primary text-primary-foreground border-primary'
                                : 'bg-[var(--bg-base)] text-muted-foreground border-border hover:border-primary/50'
                            }`}
                          >
                            {cat}
                          </button>
                        )
                      })}
                      {formData.categoriesList.length === 0 && (
                        <p className="text-xs text-muted-foreground italic">{locale === 'ar' ? 'أضف التصنيفات أعلاه أولاً.' : 'Add categories above first.'}</p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </>
        )}

        {activeTab === 'ai' && (
          <section className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl overflow-hidden shadow-sm">
            <div className="border-b border-[var(--border)] px-6 py-4 bg-muted/10">
              <h2 className="text-lg font-bold text-foreground">{locale === 'ar' ? 'الذكاء الاصطناعي والمساعد الذكي' : 'AI & Copilot'}</h2>
              <p className="text-sm text-muted-foreground mt-0.5">{locale === 'ar' ? 'تهيئة ميزات الأتمتة المدعومة بنموذج Gemini.' : 'Configure Gemini-powered automation features.'}</p>
            </div>
            <div className="p-6 space-y-6">
              
              <div className="flex items-center justify-between p-4 bg-muted/20 border border-border rounded-xl">
                <div className="space-y-0.5">
                  <p className="text-sm font-semibold text-foreground">{locale === 'ar' ? 'تفعيل الفرز والتشخيص الذكي' : 'Enable AI Triage'}</p>
                  <p className="text-xs text-muted-foreground">{locale === 'ar' ? 'استخدام الذكاء الاصطناعي لاقتراح الأولويات والتصنيفات تلقائياً.' : 'Use AI to automatically suggest priorities and categories for new tickets.'}</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" name="enableAiTriage" checked={formData.enableAiTriage} onChange={handleChange} className="sr-only peer" />
                  <div className="w-9 h-5 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>

              <div className="flex items-center justify-between p-4 bg-muted/20 border border-border rounded-xl">
                <div className="space-y-0.5">
                  <p className="text-sm font-semibold text-foreground">{locale === 'ar' ? 'القواعد الاستدلالية البديلة' : 'Fallback Heuristics'}</p>
                  <p className="text-xs text-muted-foreground">{locale === 'ar' ? 'الاعتماد على الكلمات المفتاحية في حال عدم توفر خدمة الذكاء الاصطناعي.' : 'Fall back to keyword-based routing if the AI API is unavailable.'}</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" name="fallbackHeuristicsEnabled" checked={formData.fallbackHeuristicsEnabled} onChange={handleChange} className="sr-only peer" />
                  <div className="w-9 h-5 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>

            </div>
          </section>
        )}

        {activeTab === 'canned' && (
          <section className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl overflow-hidden shadow-sm">
            <div className="border-b border-[var(--border)] px-6 py-4 bg-muted/10 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-foreground">{locale === 'ar' ? 'إدارة الردود الجاهزة' : 'Canned Responses Manager'}</h2>
                <p className="text-sm text-muted-foreground mt-0.5">{locale === 'ar' ? 'قوالب ردود جاهزة ومعدة مسبقاً للمشاكل المتكررة.' : 'Pre-written reply templates for common issues.'}</p>
              </div>
              <button onClick={() => setIsResponseModalOpen(true)} className="btn btn-secondary flex items-center gap-1.5 h-8 px-3 text-sm">
                <Plus className="w-3.5 h-3.5" />
                {locale === 'ar' ? 'إضافة رد جاهز' : 'Add'}
              </button>
            </div>
            <div className="p-0">
              {formData.cannedResponses.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-sm">{locale === 'ar' ? 'لم يتم إنشاء أي ردود جاهزة بعد.' : 'No canned responses created yet.'}</div>
              ) : (
                <div className="divide-y divide-border">
                  {formData.cannedResponses.map(resp => (
                    <div key={resp.id} className="p-4 flex gap-4 hover:bg-muted/10 transition-colors">
                      <div className="flex-1 space-y-1">
                        <h4 className="font-medium text-sm text-foreground">{resp.title}</h4>
                        <p className="text-xs text-muted-foreground line-clamp-2">{resp.content}</p>
                      </div>
                      <button onClick={() => handleRemoveResponse(resp.id)} className="text-muted-foreground hover:text-destructive shrink-0 h-fit p-1">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        <div className="flex justify-end pt-2">
          <button
            onClick={handleSave}
            disabled={isPending}
            className="btn btn-primary flex items-center gap-2 h-10 px-8 shadow-sm text-sm font-medium"
          >
            {isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {isPending ? (locale === 'ar' ? 'جاري الحفظ...' : 'Saving...') : (locale === 'ar' ? 'حفظ كافة الإعدادات' : 'Save All Settings')}
          </button>
        </div>

      </div>

      {/* Canned Response Modal */}
      {isResponseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="bg-[var(--bg-surface)] border border-border rounded-2xl w-full max-w-lg shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h3 className="font-semibold">{locale === 'ar' ? 'إضافة رد جاهز' : 'Add Canned Response'}</h3>
              <button onClick={() => setIsResponseModalOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">{locale === 'ar' ? 'العنوان' : 'Title'}</label>
                <input
                  type="text"
                  value={newResponse.title}
                  onChange={(e) => setNewResponse(prev => ({ ...prev, title: e.target.value }))}
                  placeholder={locale === 'ar' ? 'مثال: تعليمات إعادة تعيين كلمة المرور' : 'e.g. Password Reset'}
                  className="w-full px-3 py-2 bg-[var(--bg-base)] border border-[var(--border)] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">{locale === 'ar' ? 'المحتوى' : 'Content'}</label>
                <textarea
                  value={newResponse.content}
                  onChange={(e) => setNewResponse(prev => ({ ...prev, content: e.target.value }))}
                  rows={4}
                  placeholder={locale === 'ar' ? 'اكتب نص الرد الجاهز هنا بالتفصيل...' : 'The template message body...'}
                  className="w-full px-3 py-2 bg-[var(--bg-base)] border border-[var(--border)] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-border bg-muted/10 flex justify-end gap-2">
              <button onClick={() => setIsResponseModalOpen(false)} className="px-4 py-2 text-sm font-medium hover:bg-muted rounded-xl transition-colors">
                {locale === 'ar' ? 'إلغاء' : 'Cancel'}
              </button>
              <button onClick={handleAddResponse} className="btn btn-primary px-4 py-2 text-sm">
                {locale === 'ar' ? 'حفظ النموذج' : 'Save Template'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
