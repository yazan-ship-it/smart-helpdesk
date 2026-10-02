/**
 * Ticket triage: validating Gemini's answer, and the keyword-rule fallback used
 * when the AI is unavailable. Pure functions so they can be unit tested.
 */

export type Locale = 'en' | 'ar'
export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
export const PRIORITIES: Priority[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']

export type TriageFields = {
  category: string
  priority: Priority
  selfHelp: string[]
  reason: string
}

/** `source` tells the UI whether Gemini produced this or the keyword rules did. */
export type TriageSuggestion = TriageFields & { source: 'ai' | 'rules' }

/**
 * Validate a parsed Gemini response. Throws if the model returned anything
 * outside the allowed categories/priorities, so callers can fall back.
 */
export function parseTriageResponse(raw: unknown, categories: string[]): TriageFields {
  if (!raw || typeof raw !== 'object') throw new Error('AI triage: response is not an object')
  const r = raw as Record<string, unknown>

  if (typeof r.category !== 'string' || !categories.includes(r.category)) {
    throw new Error(`AI triage: unknown category ${JSON.stringify(r.category)}`)
  }
  if (typeof r.priority !== 'string' || !PRIORITIES.includes(r.priority as Priority)) {
    throw new Error(`AI triage: unknown priority ${JSON.stringify(r.priority)}`)
  }
  const selfHelp = Array.isArray(r.selfHelp)
    ? r.selfHelp.filter((s): s is string => typeof s === 'string' && s.trim().length > 0).map((s) => s.trim())
    : []
  if (selfHelp.length === 0) throw new Error('AI triage: missing self-help steps')

  return {
    category: r.category,
    priority: r.priority as Priority,
    selfHelp: selfHelp.slice(0, 4),
    reason: typeof r.reason === 'string' ? r.reason.trim() : '',
  }
}

// ─── Keyword rules (fallback) ─────────────────────────────────────────────────

type Rule = {
  category: string
  /** English keywords are matched on word boundaries, Arabic ones as substrings. */
  en: string[]
  ar: string[]
  priority: Priority
  tips: Record<Locale, string[]>
}

// Order matters: the first matching rule wins (e.g. "network printer" is a printer issue).
const RULES: Rule[] = [
  {
    category: 'Security',
    en: ['phishing', 'virus', 'malware', 'ransomware', 'hacked', 'suspicious', 'breach', 'compromised'],
    ar: ['تصيد', 'فيروس', 'اختراق', 'برمجية خبيثة', 'مشبوه'],
    priority: 'HIGH',
    tips: {
      en: [
        'Do not click any more links or open attachments from the suspicious message.',
        'Disconnect the device from the network if you think it is infected.',
        'Do not delete the suspicious email; IT may need it for the investigation.',
      ],
      ar: [
        'لا تضغط على أي روابط أو مرفقات أخرى من الرسالة المشبوهة.',
        'افصل الجهاز عن الشبكة إذا كنت تعتقد أنه مصاب.',
        'لا تحذف الرسالة المشبوهة، فقد يحتاجها فريق الدعم للتحقيق.',
      ],
    },
  },
  {
    category: 'Printer',
    en: ['printer', 'print', 'printing', 'toner', 'paper jam', 'scanner'],
    ar: ['طابعة', 'طباعة', 'حبر', 'ورق', 'ماسح'],
    priority: 'LOW',
    tips: {
      en: [
        'Check the printer screen for an error code and note it in the ticket.',
        'Turn the printer off and on again, then resend the print job.',
        'Make sure you selected the right printer and it shows as online.',
      ],
      ar: [
        'تحقق من شاشة الطابعة بحثاً عن رمز خطأ واكتبه في التذكرة.',
        'أطفئ الطابعة ثم شغّلها مرة أخرى وأعد إرسال أمر الطباعة.',
        'تأكد من اختيار الطابعة الصحيحة وأنها تظهر متصلة.',
      ],
    },
  },
  {
    category: 'Email & Communication',
    en: ['email', 'e-mail', 'outlook', 'mailbox', 'smtp', 'teams', 'calendar'],
    ar: ['بريد', 'إيميل', 'ايميل', 'أوتلوك', 'تيمز'],
    priority: 'MEDIUM',
    tips: {
      en: [
        'Check whether you can send and receive email from the web version of your mailbox.',
        'Restart the mail app and check that you are connected to the internet.',
        'Note the exact error message or bounce-back text in the ticket.',
      ],
      ar: [
        'تحقق مما إذا كان بإمكانك الإرسال والاستقبال من نسخة الويب لبريدك.',
        'أعد تشغيل تطبيق البريد وتأكد من اتصالك بالإنترنت.',
        'اكتب نص رسالة الخطأ أو رسالة الارتداد كما هي في التذكرة.',
      ],
    },
  },
  {
    category: 'Access & Permissions',
    en: ['password', 'login', 'log in', 'sign in', 'locked out', 'access', 'permission', 'sso', 'mfa', '2fa'],
    ar: ['كلمة المرور', 'كلمة السر', 'تسجيل الدخول', 'صلاحية', 'صلاحيات', 'وصول', 'مقفل'],
    priority: 'MEDIUM',
    tips: {
      en: [
        'Check that Caps Lock is off and try typing your password again.',
        'Try signing in from a private browser window to rule out cached sessions.',
        'If you need new access, note which system and which level of access you need.',
      ],
      ar: [
        'تأكد من أن مفتاح الأحرف الكبيرة غير مفعّل وأعد كتابة كلمة المرور.',
        'جرّب تسجيل الدخول من نافذة تصفح خاصة لاستبعاد الجلسات المحفوظة.',
        'إذا كنت تحتاج صلاحية جديدة، اذكر النظام ومستوى الصلاحية المطلوب.',
      ],
    },
  },
  {
    category: 'Network',
    en: ['vpn', 'wifi', 'wi-fi', 'network', 'internet', 'dns', 'gateway', 'ethernet', 'connection'],
    ar: ['شبكة', 'إنترنت', 'انترنت', 'واي فاي', 'اتصال'],
    priority: 'MEDIUM',
    tips: {
      en: [
        'Disconnect and reconnect to the Wi-Fi or VPN.',
        'Check whether other websites or colleagues nearby have the same problem.',
        'Restart your device and try again.',
      ],
      ar: [
        'افصل الاتصال بالشبكة أو الـ VPN ثم أعد الاتصال.',
        'تحقق مما إذا كانت مواقع أخرى أو زملاء بجانبك يواجهون المشكلة نفسها.',
        'أعد تشغيل جهازك وحاول مرة أخرى.',
      ],
    },
  },
  {
    category: 'Hardware',
    en: ['laptop', 'computer', 'screen', 'monitor', 'keyboard', 'mouse', 'battery', 'charger', 'hardware', 'overheating'],
    ar: ['لابتوب', 'حاسوب', 'كمبيوتر', 'شاشة', 'لوحة المفاتيح', 'ماوس', 'بطارية', 'شاحن'],
    priority: 'MEDIUM',
    tips: {
      en: [
        'Check that all cables are firmly connected and the power is on.',
        'Restart the device. If it will not start, hold the power button for 15 seconds.',
        'Stop using the device if it is swollen, smoking or very hot.',
      ],
      ar: [
        'تأكد من توصيل جميع الكابلات بإحكام وأن الجهاز موصول بالكهرباء.',
        'أعد تشغيل الجهاز، وإذا لم يعمل اضغط زر التشغيل لمدة 15 ثانية.',
        'توقف عن استخدام الجهاز إذا كان منتفخاً أو يصدر دخاناً أو ساخناً جداً.',
      ],
    },
  },
  {
    category: 'Software',
    en: ['install', 'license', 'crash', 'crashes', 'update', 'software', 'application', 'app', 'error'],
    ar: ['برنامج', 'تطبيق', 'ترخيص', 'تثبيت', 'تحديث', 'خطأ'],
    priority: 'MEDIUM',
    tips: {
      en: [
        'Close the application completely and open it again.',
        'Check whether an update is available for the application.',
        'Note the exact error message and what you were doing when it appeared.',
      ],
      ar: [
        'أغلق التطبيق بالكامل ثم افتحه مرة أخرى.',
        'تحقق مما إذا كان هناك تحديث متوفر للتطبيق.',
        'اكتب رسالة الخطأ كما هي وما كنت تفعله عند ظهورها.',
      ],
    },
  },
]

const GENERIC_TIPS: Record<Locale, string[]> = {
  en: [
    'Restart the affected device or application and check whether the problem continues.',
    'Note any error message exactly as it appears.',
    'Attach a screenshot if you can.',
  ],
  ar: [
    'أعد تشغيل الجهاز أو التطبيق المتأثر وتحقق مما إذا استمرت المشكلة.',
    'اكتب أي رسالة خطأ كما تظهر تماماً.',
    'أرفق لقطة شاشة إن أمكن.',
  ],
}

const CRITICAL_SIGNALS = {
  en: ['outage', 'everyone', 'all users', 'whole office', 'production', 'data loss', 'ransomware', 'smoke', 'fire'],
  ar: ['انقطاع كامل', 'الجميع', 'كل الموظفين', 'فقدان بيانات', 'دخان', 'حريق'],
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function matches(text: string, en: string[], ar: string[]) {
  const lower = text.toLowerCase()
  return (
    en.some((k) => new RegExp(`\\b${escapeRegExp(k)}\\b`).test(lower)) ||
    ar.some((k) => text.includes(k))
  )
}

/** Pick the rule's category if the admin still has it, otherwise "Other", otherwise the first one. */
function resolveCategory(wanted: string, categories: string[]) {
  if (categories.includes(wanted)) return wanted
  if (categories.includes('Other')) return 'Other'
  return categories[0] ?? wanted
}

export function ruleBasedTriage(
  title: string,
  description: string,
  categories: string[],
  locale: Locale,
): TriageSuggestion {
  const text = `${title}\n${description}`
  const rule = RULES.find((r) => matches(text, r.en, r.ar))
  const critical = matches(text, CRITICAL_SIGNALS.en, CRITICAL_SIGNALS.ar)

  const category = resolveCategory(rule?.category ?? 'Other', categories)
  const priority: Priority = critical ? 'CRITICAL' : (rule?.priority ?? 'MEDIUM')

  const reason = rule
    ? locale === 'ar'
      ? `تطابقت كلمات مفتاحية في وصفك مع فئة "${category}".`
      : `Keywords in your description match the "${category}" category.`
    : locale === 'ar'
      ? 'لم تتطابق أي كلمات مفتاحية، فتم اقتراح فئة عامة.'
      : 'No keywords matched, so a general category was suggested.'

  return {
    source: 'rules',
    category,
    priority,
    selfHelp: rule?.tips[locale] ?? GENERIC_TIPS[locale],
    reason,
  }
}
