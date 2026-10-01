'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { LogOut, Monitor, Moon, Sun, Globe } from 'lucide-react'
import { useTheme } from 'next-themes'
import { logout } from '@/app/actions/auth'
import { useTranslation } from '@/lib/i18n'
import { getRoleLabel } from '@/lib/roles'

type Props = {
  user: {
    name: string
    role: string
  }
  placement?: 'top' | 'bottom-end'
}

export default function UserDropdown({ user, placement = 'bottom-end' }: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const { theme, setTheme } = useTheme()
  const { t, locale, setLocale, toggleLanguage, isRTL } = useTranslation()

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const positionClasses =
    placement === 'top'
      ? 'bottom-[calc(100%+8px)] start-0 origin-bottom w-full'
      : 'top-[calc(100%+8px)] end-0 origin-top w-56'

  const yOffset = placement === 'top' ? 10 : -10

  return (
    <div className={`relative ${placement === 'top' ? 'w-full' : ''}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-3 p-1.5 rounded-xl hover:bg-muted transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer relative z-10 ${placement === 'top' ? 'w-full justify-start' : ''}`}
      >
        {placement === 'top' && (
          <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white shadow-sm bg-indigo-500 shrink-0">
            {user.name?.charAt(0).toUpperCase()}
          </div>
        )}
        <div className={`${placement === 'top' ? 'text-start' : 'text-end'} hidden sm:block`}>
          <p className="text-sm font-medium leading-tight text-foreground">
            {user.name}
          </p>
          <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
            {getRoleLabel(user.role, locale)}
          </p>
        </div>
        {placement === 'bottom-end' && (
          <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white shadow-sm bg-indigo-500 shrink-0">
            {user.name?.charAt(0).toUpperCase()}
          </div>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: yOffset }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: yOffset }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className={`absolute z-50 bg-popover text-popover-foreground border border-border rounded-xl shadow-xl overflow-hidden ${positionClasses}`}
          >
            <div className="p-3 border-b border-border bg-muted/40">
              <p className="text-xs font-semibold text-foreground truncate">
                {user.name}
              </p>
              <p className="text-[10px] text-muted-foreground truncate uppercase font-medium mt-0.5">
                {getRoleLabel(user.role, locale)}
              </p>
            </div>

            {/* Language Switcher directly ABOVE Theme selector */}
            <div className="p-1.5 border-b border-border space-y-1">
              <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-indigo-500" />
                  <span>{locale === 'ar' ? 'اللغة / Language' : 'Language / اللغة'}</span>
                </span>
                <span className="text-[10px] font-mono font-bold text-indigo-600 dark:text-indigo-400 px-1.5 py-0.2 rounded bg-indigo-500/10">
                  {locale === 'ar' ? 'العربية' : 'EN'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-1 p-0.5 bg-muted/60 rounded-lg">
                <button
                  type="button"
                  onClick={() => setLocale('ar')}
                  className={`flex items-center justify-center gap-1 py-1.5 px-2 rounded-md text-xs font-medium transition-all cursor-pointer ${
                    locale === 'ar'
                      ? 'bg-background text-foreground shadow-xs font-bold'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <span>العربية</span>
                </button>
                <button
                  type="button"
                  onClick={() => setLocale('en')}
                  className={`flex items-center justify-center gap-1 py-1.5 px-2 rounded-md text-xs font-medium transition-all cursor-pointer ${
                    locale === 'en'
                      ? 'bg-background text-foreground shadow-xs font-bold'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <span>English</span>
                </button>
              </div>
            </div>

            {/* Quick Theme Switch inside user dropdown */}
            <div className="p-1.5 space-y-0.5">
              <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                {locale === 'ar' ? 'المظهر' : 'Theme'}
              </div>
              <button
                type="button"
                onClick={() => setTheme('light')}
                className={`w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-lg transition-colors cursor-pointer ${theme === 'light' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'}`}
              >
                <Sun className="w-4 h-4" /> {locale === 'ar' ? 'فاتح' : 'Light'}
              </button>
              <button
                type="button"
                onClick={() => setTheme('dark')}
                className={`w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-lg transition-colors cursor-pointer ${theme === 'dark' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'}`}
              >
                <Moon className="w-4 h-4" /> {locale === 'ar' ? 'داكن' : 'Dark'}
              </button>
              <button
                type="button"
                onClick={() => setTheme('system')}
                className={`w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-lg transition-colors cursor-pointer ${theme === 'system' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'}`}
              >
                <Monitor className="w-4 h-4" /> {locale === 'ar' ? 'تلقائي (النظام)' : 'System'}
              </button>
            </div>

            <div className="p-1.5 border-t border-border">
              <form action={logout}>
                <button
                  type="submit"
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-lg text-red-500 hover:bg-red-500/10 hover:text-red-600 transition-colors cursor-pointer"
                >
                  <LogOut className="w-4 h-4 rtl:rotate-180" />
                  <span>{t('userDropdown.signOut')}</span>
                </button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
