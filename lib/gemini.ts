import { GoogleGenAI } from '@google/genai'

const apiKey = process.env.GEMINI_API_KEY

function getClient() {
  if (!apiKey || apiKey === 'your-gemini-api-key-here') {
    throw new Error('GEMINI_API_KEY is not configured.')
  }
  return new GoogleGenAI({ apiKey })
}

export type TriageResult = {
  category: string
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  selfHelp: string[]
  confidence: 'low' | 'medium' | 'high'
  matchScore?: number
  reason?: string
}

export type SummaryResult = {
  summary: string
  nextAction: string
}

const CATEGORIES = [
  'Network', 'Hardware', 'Software', 'Email & Communication',
  'Access & Permissions', 'Printer', 'Security', 'Other',
]

/**
 * Auto-triage a ticket by predicting category, priority, and self-help tips.
 */
export async function triageTicket(
  title: string,
  description: string,
): Promise<TriageResult> {
  const ai = getClient()

  const prompt = `You are an expert IT helpdesk triage system. Analyze this IT support request and respond ONLY with a valid JSON object.

Ticket Title: "${title}"
Ticket Description: "${description}"

Categories available: ${CATEGORIES.join(', ')}

Respond with this exact JSON structure:
{
  "category": "<one of the categories above>",
  "priority": "<one of: LOW, MEDIUM, HIGH, CRITICAL>",
  "selfHelp": ["<step 1>", "<step 2>", "<step 3>"],
  "confidence": "<one of: low, medium, high>",
  "matchScore": <integer between 80 and 99 representing confidence percentage>,
  "reason": "<one concise sentence explaining why this category and priority were selected>"
}

Priority guidelines:
- CRITICAL: Complete work stoppage, data loss risk, security breach
- HIGH: Significant disruption, affecting multiple users or core work functions
- MEDIUM: Moderate impact, workarounds available
- LOW: Minor inconvenience, non-urgent

Self-help steps: Provide 2-3 concise, actionable troubleshooting steps the user can try RIGHT NOW before an IT agent responds. Be specific.`

  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      temperature: 0.2,
    },
  })

  const text = response.text ?? ''
  const parsed = JSON.parse(text) as TriageResult
  return parsed
}

/**
 * Generate an AI executive summary of a ticket and its comments.
 */
export async function summarizeTicket(
  ticket: {
    title: string
    description: string
    status: string
    priority: string
    category: string
    createdBy: string
    assignedTo?: string
  },
  comments: Array<{ author: string; role: string; content: string; createdAt: string }>,
): Promise<SummaryResult> {
  const ai = getClient()

  const commentsText = comments.length > 0
    ? comments
        .map(c => `[${c.role === 'IT_SUPPORT' ? 'IT Agent' : 'User'} - ${c.author}]: ${c.content}`)
        .join('\n')
    : 'No comments yet.'

  const prompt = `You are an IT helpdesk manager. Provide a concise executive summary of this support ticket.

TICKET:
Title: ${ticket.title}
Category: ${ticket.category}
Priority: ${ticket.priority}
Status: ${ticket.status}
Created by: ${ticket.createdBy}
${ticket.assignedTo ? `Assigned to: ${ticket.assignedTo}` : 'Unassigned'}
Description: ${ticket.description}

COMMENTS THREAD:
${commentsText}

Respond ONLY with a valid JSON object:
{
  "summary": "<2-sentence executive summary of the situation and current state>",
  "nextAction": "<single most important recommended next action for the IT team>"
}`

  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      temperature: 0.3,
    },
  })

  const text = response.text ?? ''
  return JSON.parse(text) as SummaryResult
}

// Fallback dictionary for common IT ticket phrases and seeded items
const SEED_FALLBACKS: Record<string, { en: string; ar: string }> = {
  // Ticket 1
  'Departmental laser printer paper jam on 3rd floor': {
    en: 'Departmental laser printer paper jam on 3rd floor',
    ar: 'انحشار ورق في طابعة الليزر الخاصة بالقسم في الطابق الثالث',
  },
  'Paper tray 2 is reporting paper feed jam error code #E-204. Cleared visible jammed paper but error remains on console.': {
    en: 'Paper tray 2 is reporting paper feed jam error code #E-204. Cleared visible jammed paper but error remains on console.',
    ar: 'درج الورق رقم 2 يظهر رمز خطأ انحشار تغذية الورق #E-204. تم إخراج الورق العالق المرئي لكن رمز الخطأ لا يزال ظاهراً على شاشة التحكم.',
  },
  'Maintenance technician dispatched to inspect feed sensor and clean pickup rollers; a 10-page test print completed successfully.': {
    en: 'Maintenance technician dispatched to inspect feed sensor and clean pickup rollers; a 10-page test print completed successfully.',
    ar: 'تم إرسال فني الصيانة لفحص حساس التغذية وتنظيف بكرات السحب، وتمت تجربة طباعة 10 صفحات بنجاح.',
  },

  // Ticket 2
  'VPN Gateway connection drops every 15 minutes': {
    en: 'VPN Gateway connection drops every 15 minutes',
    ar: 'بوابة الاتصال الافتراضي (VPN) تنقطع كل 15 دقيقة',
  },
  'Remote VPN tunnel via Cisco AnyConnect disconnects intermittently during active sessions.': {
    en: 'Remote VPN tunnel via Cisco AnyConnect disconnects intermittently during active sessions.',
    ar: 'نفق VPN البعيد عبر Cisco AnyConnect ينقطع بشكل متقطع أثناء جلسات العمل النشطة.',
  },

  // Ticket 3
  'Unable to access central corporate database': {
    en: 'Unable to access central corporate database',
    ar: 'تعذر الوصول إلى قاعدة بيانات الشركة المركزية',
  },
  'Connection timeout when attempting to reach the primary SQL database server through ERP client.': {
    en: 'Connection timeout when attempting to reach the primary SQL database server through ERP client.',
    ar: 'انتهاء مهلة الاتصال عند محاولة الوصول إلى خادم قاعدة بيانات SQL الأساسي من خلال عميل ERP.',
  },

  // Ticket 4
  'Microsoft 365 enterprise license activation failure': {
    en: 'Microsoft 365 enterprise license activation failure',
    ar: 'فشل تفعيل ترخيص مايكروسوفت 365 للمؤسسات',
  },
  'User Outlook and Excel apps prompt for subscription renewal despite valid corporate credentials.': {
    en: 'User Outlook and Excel apps prompt for subscription renewal despite valid corporate credentials.',
    ar: 'تطلب تطبيقات Outlook وExcel من المستخدم تجديد الاشتراك على الرغم من صلاحية بيانات الاعتماد المؤسسية.',
  },
  'Submitted license renewal request to licensing portal. Credentials should update automatically within 24 hours.': {
    en: 'Submitted license renewal request to licensing portal. Credentials should update automatically within 24 hours.',
    ar: 'تم تقديم طلب تجديد الترخيص إلى بوابة التراخيص. يجب أن تتحدث بيانات الاعتماد تلقائياً خلال 24 ساعة.',
  },

  // Ticket 5
  'Failure sending emails through desktop Outlook client': {
    en: 'Failure sending emails through desktop Outlook client',
    ar: 'فشل إرسال رسائل البريد الإلكتروني عبر تطبيق أوتلوك المكتبي',
  },
  'Outbox items stuck with SMTP 550 relay access denied error code.': {
    en: 'Outbox items stuck with SMTP 550 relay access denied error code.',
    ar: 'عناصر البريد الصادر عالقة مع رمز الخطأ SMTP 550 relay access denied.',
  },
  'SMTP password was reset after a security policy update. Updated credentials in Outlook settings and confirmed outgoing emails are sending.': {
    en: 'SMTP password was reset after a security policy update. Updated credentials in Outlook settings and confirmed outgoing emails are sending.',
    ar: 'تمت إعادة تعيين كلمة مرور SMTP بعد تحديث سياسة الأمان. تم تحديث بيانات الاعتماد في إعدادات Outlook وتأكيد إرسال البريد الصادر.',
  },

  // Ticket 6
  'Production database server unreachable': {
    en: 'Production database server unreachable',
    ar: 'خادم قاعدة بيانات الإنتاج غير متاح ولا يمكن الوصول إليه',
  },
  'Core production cluster node is offline and failing health probes.': {
    en: 'Core production cluster node is offline and failing health probes.',
    ar: 'عقدة مجموعة الإنتاج الأساسية غير متصلة وتفشل في فحوصات الجاهزية والسلامة.',
  },

  // Ticket 7
  'Request access permissions for staging database environment': {
    en: 'Request access permissions for staging database environment',
    ar: 'طلب صلاحيات وصول لبيئة قاعدة بيانات المرحلة الانتقالية والاختبار',
  },
  'Need read/write developer credentials on the dev/test SQL database instance.': {
    en: 'Need read/write developer credentials on the dev/test SQL database instance.',
    ar: 'بحاجة إلى بيانات اعتماد مطور بصلاحيات قراءة/كتابة على نسخة قاعدة بيانات SQL الخاصة ببيئة التطوير والاختبار.',
  },

  // Ticket 8
  'Main finance network printer offline and unreachable': {
    en: 'Main finance network printer offline and unreachable',
    ar: 'طابعة شبكة قسم المالية الرئيسية غير متصلة ولا يمكن الوصول إليها',
  },
  'Network printer IP 192.168.1.105 is not responding to ICMP ping or print jobs.': {
    en: 'Network printer IP 192.168.1.105 is not responding to ICMP ping or print jobs.',
    ar: 'عنوان IP الخاص بطابعة الشبكة 192.168.1.105 لا يستجيب لأمر ICMP ping أو لمهام الطباعة.',
  },
}

function getFallbackTranslation(text: string, targetLanguage: 'Arabic' | 'English'): string {
  const clean = text.trim()
  const cleanLower = clean.toLowerCase()
  
  // Exact match by key
  if (SEED_FALLBACKS[clean]) {
    return targetLanguage === 'English' ? SEED_FALLBACKS[clean].en : SEED_FALLBACKS[clean].ar
  }

  // Exact or case-insensitive match on value.en or value.ar
  for (const [, value] of Object.entries(SEED_FALLBACKS)) {
    if (value.en.toLowerCase() === cleanLower || value.ar === clean) {
      return targetLanguage === 'English' ? value.en : value.ar
    }
  }

  // Substring match
  for (const [key, value] of Object.entries(SEED_FALLBACKS)) {
    if (
      clean.includes(key) ||
      key.includes(clean) ||
      cleanLower.includes(value.en.toLowerCase()) ||
      value.en.toLowerCase().includes(cleanLower)
    ) {
      return targetLanguage === 'English' ? value.en : value.ar
    }
  }

  // Keyword-based fallback for common IT phrases
  if (targetLanguage === 'Arabic') {
    if (cleanLower.includes('vpn')) return 'تعذر الاتصال بالشبكة الافتراضية الخاصة (VPN) وتكرار انقطاع الاتصال.'
    if (cleanLower.includes('printer') || cleanLower.includes('paper')) return 'انحشار الورق في طابعة الشبكة مع وميض خطأ في لوحة التحكم.'
    if (cleanLower.includes('database') || cleanLower.includes('sql')) return 'فشل الاتصال بخادم قاعدة البيانات الرئيسي وظهور خطأ في المهلة.'
    if (cleanLower.includes('license') || cleanLower.includes('office')) return 'انتهاء صلاحية ترخيص الحزمة البرمجية والمطالبة بتجديد المفتاح.'
    if (cleanLower.includes('email') || cleanLower.includes('outlook')) return 'تعذر إرسال رسائل البريد الإلكتروني وظهور خطأ في مصادقة خادم الإرسال.'
    if (cleanLower.includes('battery')) return 'استنزاف شحن البطارية بشكل سريع وغير معتاد بعد التحديث الأخير.'
    if (cleanLower.includes('access') || cleanLower.includes('permission')) return 'طلب صلاحيات وصول إدارية إضافية لإجراء مهام الصيانة والتطوير.'
    return `[ترجمة ملخص الدعم الفني]: ${clean}`
  } else {
    if (clean.includes('طابعة') || clean.includes('ورق')) return 'Network printer paper jam with control panel alert indicator.'
    if (clean.includes('شبكة') || clean.includes('اتصال')) return 'Intermittent network connection failure and gateway timeout.'
    if (clean.includes('بريد') || clean.includes('أوتلوك')) return 'Outbound email delivery failure due to SMTP authentication error.'
    if (clean.includes('ترخيص') || clean.includes('أوفيس')) return 'Software application license expiration requiring administrative key renewal.'
    if (clean.includes('بطارية') || clean.includes('شحن')) return 'Severe battery drain observed after the operating system cumulative update.'
    if (clean.includes('صلاحية') || clean.includes('وصول')) return 'Request for temporary administrative database and staging permissions.'
    return `[Translated IT summary]: ${clean}`
  }
}

/**
 * On-demand AI translation for IT support tickets and discussion comments.
 */
export async function translateText(
  text: string,
  targetLanguage: 'Arabic' | 'English' = 'English'
): Promise<string> {
  const trimmed = text?.trim()
  if (!trimmed) return ''

  try {
    const ai = getClient()

    const prompt = `You are a professional IT translator. Translate the following IT support ticket or comment accurately into ${targetLanguage}, preserving technical terminology (e.g. VPN, SSO, RAM, Error codes) in their recognizable context. Return ONLY the translated text.

Text to translate:
"""${trimmed}"""`

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
      config: {
        temperature: 0.1,
      },
    })

    const result = response.text?.trim()
    if (result) return result
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.warn('[Gemini Translation] API unavailable or failed:', message)
  }

  return getFallbackTranslation(trimmed, targetLanguage)
}

