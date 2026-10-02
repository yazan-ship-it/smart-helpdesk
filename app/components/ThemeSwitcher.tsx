'use client'

import { useState, useRef, useEffect } from 'react'
import { useTheme } from 'next-themes'
import { Sun, Moon, Monitor, Palette, Check } from 'lucide-react'
import { useIsClient } from '@/lib/useIsClient'
import { useTranslation } from '@/lib/i18n'

type AccentColor = 'blue' | 'slate' | 'violet' | 'emerald'

const ACCENT_OPTIONS: { value: AccentColor; labelEn: string; labelAr: string; color: string }[] = [
  { value: 'blue', labelEn: 'Corporate Blue', labelAr: 'أزرق كلاسيكي', color: '#4f46e5' },
  { value: 'slate', labelEn: 'Slate / Zinc', labelAr: 'رمادي أنيق', color: '#64748b' },
  { value: 'violet', labelEn: 'Violet / Indigo', labelAr: 'بنفسجي داكن', color: '#7c3aed' },
  { value: 'emerald', labelEn: 'Emerald Green', labelAr: 'أخضر زمردي', color: '#059669' },
]

const MODE_OPTIONS = [
  { value: 'light', labelEn: 'Light', labelAr: 'فاتح', icon: Sun },
  { value: 'dark', labelEn: 'Dark', labelAr: 'داكن', icon: Moon },
  { value: 'system', labelEn: 'System', labelAr: 'تلقائي', icon: Monitor },
]

export default function ThemeSwitcher({ placement = 'top' }: { placement?: 'top' | 'bottom' }) {
  const { theme, setTheme } = useTheme()
  const { t, locale } = useTranslation()
  const [accent, setAccent] = useState<AccentColor>(() =>
    (typeof window !== 'undefined' && (localStorage.getItem('helpdesk-accent') as AccentColor | null)) || 'blue'
  )
  const [open, setOpen] = useState(false)
  // next-themes only knows the theme on the client
  const mounted = useIsClient()
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleAccentChange = (color: AccentColor) => {
    setAccent(color)
    localStorage.setItem('helpdesk-accent', color)
    document.documentElement.setAttribute('data-accent', color)
  }

  if (!mounted) return null

  return (
    <div ref={panelRef} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="btn btn-ghost btn-icon"
        title={locale === 'ar' ? 'المظهر وتخصيص الألوان' : 'Theme & Appearance'}
        aria-label={t('ui.openThemeSwitcher')}
      >
        <Palette
          className="w-4 h-4"
          style={{ color: open ? 'var(--brand)' : 'var(--text-muted)' }}
        />
      </button>

      {open && (
        <div
          className={`absolute z-50 w-64 max-h-[80vh] overflow-y-auto bg-card text-card-foreground shadow-xl border border-border rounded-xl animate-fade-up ${
            placement === 'top' ? 'top-full mt-2 end-0' : 'bottom-full mb-2 start-0'
          }`}
          style={{ padding: '10px' }}
        >
          {/* Mode section */}
          <p
            className="text-[10px] font-semibold uppercase tracking-wider mb-2 px-1"
            style={{ color: 'var(--text-xmuted)' }}
          >
            {locale === 'ar' ? 'المظهر' : 'Appearance'}
          </p>
          <div className="grid grid-cols-3 gap-1 mb-3">
            {MODE_OPTIONS.map(({ value, labelEn, labelAr, icon: Icon }) => (
              <button
                key={value}
                onClick={() => setTheme(value)}
                className={`flex flex-col items-center gap-1 py-2 px-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  theme === value
                    ? 'text-background'
                    : ''
                }`}
                style={{
                  background: theme === value ? 'var(--brand)' : 'var(--bg-elevated)',
                  color: theme === value ? '#fff' : 'var(--text-secondary)',
                  border: `1px solid ${theme === value ? 'var(--brand)' : 'var(--border)'}`,
                }}
              >
                <Icon className="w-3.5 h-3.5" />
                {locale === 'ar' ? labelAr : labelEn}
              </button>
            ))}
          </div>

          {/* Accent section */}
          <p
            className="text-[10px] font-semibold uppercase tracking-wider mb-2 px-1"
            style={{ color: 'var(--text-xmuted)' }}
          >
            {locale === 'ar' ? 'لون التمييز' : 'Accent Color'}
          </p>
          <div className="space-y-1">
            {ACCENT_OPTIONS.map(({ value, labelEn, labelAr, color }) => (
              <button
                key={value}
                onClick={() => handleAccentChange(value)}
                className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-xs transition-all cursor-pointer"
                style={{
                  background: accent === value ? 'var(--brand-muted)' : 'transparent',
                  color: 'var(--text-secondary)',
                }}
              >
                <span
                  className="w-4 h-4 rounded-full flex-shrink-0 ring-1 ring-offset-1"
                  style={{
                    background: color,
                    borderColor: accent === value ? color : 'transparent',
                  }}
                />
                <span style={{ color: accent === value ? 'var(--brand)' : 'var(--text-secondary)' }}>
                  {locale === 'ar' ? labelAr : labelEn}
                </span>
                {accent === value && (
                  <Check className="w-3 h-3 ms-auto" style={{ color: 'var(--brand)' }} />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
