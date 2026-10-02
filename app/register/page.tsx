'use client'

import { useActionState, useState, useEffect } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LifeBuoy,
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Sparkles,
  ChevronDown,
} from 'lucide-react'
import { toast } from 'sonner'
import { register, type RegisterState } from '@/app/actions/auth'
import ThemeSwitcher from '@/app/components/ThemeSwitcher'
import LanguageSwitcher from '@/app/components/LanguageSwitcher'
import { useTranslation } from '@/lib/i18n'

export default function RegisterPage() {
  const [state, action, pending] = useActionState<RegisterState, FormData>(register, undefined)
  const { t } = useTranslation()
  const [showPassword, setShowPassword] = useState(false)
  const [selectedRole, setSelectedRole] = useState<'EMPLOYEE' | 'IT_SUPPORT'>('EMPLOYEE')

  useEffect(() => {
    if (state?.fieldErrors && Object.keys(state.fieldErrors).length > 0) {
      toast.error(t('auth.fixErrors'))
    }
  }, [state, t])

  // Success screen
  if (state?.success) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4 relative font-sans">
        <div className="fixed top-6 end-6 z-50 flex items-center gap-2">
          <LanguageSwitcher />
          <ThemeSwitcher />
        </div>
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="w-full max-w-md p-8 sm:p-10 bg-card text-card-foreground border border-border/70 shadow-2xl rounded-3xl z-10 text-center space-y-5"
        >
          {/* Green check circle */}
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shadow-lg shadow-emerald-500/10">
              <CheckCircle2 className="w-8 h-8 text-emerald-500" />
            </div>
          </div>

          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground mb-2">
              {t('auth.registrationSubmitted')}
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-sm mx-auto">
              {t('auth.pendingApprovalMsg')}
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-start space-y-2">
            <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              {t('auth.whatHappensNext')}
            </p>
            <ul className="space-y-1 text-xs text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="text-amber-500 mt-0.5">•</span>
                {t('auth.nextStep1')}
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-500 mt-0.5">•</span>
                {t('auth.nextStep2')}
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-500 mt-0.5">•</span>
                {t('auth.nextStep3')}
              </li>
            </ul>
          </div>

          <Link
            href="/login"
            className="inline-flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm cursor-pointer"
          >
            <span>{t('auth.goToSignIn')}</span>
            <ArrowRight className="w-4 h-4 rtl:rotate-180" />
          </Link>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4 relative font-sans">
      {/* Language & Theme Switcher anchored cleanly at top right / end */}
      <div className="fixed top-6 end-6 z-50 flex items-center gap-2">
        <LanguageSwitcher />
        <ThemeSwitcher />
      </div>

      {/* Centered Auth Card */}
      <div className="w-full max-w-md p-8 sm:p-10 bg-card text-card-foreground border border-border/70 shadow-2xl rounded-3xl z-10">
        {/* Branding */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0">
            <LifeBuoy className="w-6 h-6 text-indigo-500" />
          </div>
          <div>
            <span className="text-xl font-extrabold tracking-tight text-foreground block leading-tight">
              {t('brand.name')}
            </span>
            <span className="text-xs text-muted-foreground block leading-tight">
              {t('brand.subTitle')}
            </span>
          </div>
        </div>

        {/* Title */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {t('auth.createAccount')}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t('auth.registerSubtitle')}
          </p>
        </div>

        {/* Form */}
        <motion.form
          action={action}
          animate={
            state?.fieldErrors && Object.keys(state.fieldErrors).length > 0
              ? { x: [-8, 8, -6, 6, -3, 3, 0] }
              : {}
          }
          transition={{ duration: 0.35 }}
          className="space-y-4"
        >
          {/* Full Name */}
          <div>
            <label htmlFor="name" className="block text-xs font-medium text-foreground mb-1.5 text-start">
              {t('auth.fullName')} <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <User className="absolute start-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none z-10" />
              <input
                id="name"
                name="name"
                type="text"
                autoComplete="name"
                required
                placeholder={t('auth.fullNamePlaceholder')}
                className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl ps-10 pe-3.5 py-2.5 text-sm text-foreground placeholder:text-[var(--text-muted)] outline-none transition-all duration-200 focus:border-indigo-500/70 focus:ring-2 focus:ring-indigo-500/30 hover:border-[var(--border-hover)]"
              />
            </div>
            {state?.fieldErrors?.name && (
              <p className="mt-1.5 text-xs text-red-400 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                {t('auth.registerErrors.name')}
              </p>
            )}
          </div>

          {/* Email */}
          <div>
            <label htmlFor="email" className="block text-xs font-medium text-foreground mb-1.5 text-start">
              {t('auth.workEmail')} <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <Mail className="absolute start-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none z-10" />
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder={t('auth.emailPlaceholder')}
                className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl ps-10 pe-3.5 py-2.5 text-sm text-foreground placeholder:text-[var(--text-muted)] outline-none transition-all duration-200 focus:border-indigo-500/70 focus:ring-2 focus:ring-indigo-500/30 hover:border-[var(--border-hover)]"
              />
            </div>
            {state?.fieldErrors?.email && (
              <p className="mt-1.5 text-xs text-red-400 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                {t('auth.registerErrors.email')}
              </p>
            )}
          </div>

          {/* Password */}
          <div>
            <label
              htmlFor="password"
              className="block text-xs font-medium text-foreground mb-1.5 text-start"
            >
              {t('auth.password')} <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <Lock className="absolute start-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none z-10" />
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                required
                placeholder={t('auth.passwordPlaceholder')}
                className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl ps-10 pe-10 py-2.5 text-sm text-foreground placeholder:text-[var(--text-muted)] outline-none transition-all duration-200 focus:border-indigo-500/70 focus:ring-2 focus:ring-indigo-500/30 hover:border-[var(--border-hover)]"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute end-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                tabIndex={-1}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {state?.fieldErrors?.password && (
              <p className="mt-1.5 text-xs text-red-400 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                {t('auth.registerErrors.password')}
              </p>
            )}
          </div>

          {/* Requested Role */}
          <div>
            <label htmlFor="role" className="block text-xs font-medium text-foreground mb-1.5 text-start">
              {t('auth.requestedRole')} <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <select
                id="role"
                name="role"
                required
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value as 'EMPLOYEE' | 'IT_SUPPORT')}
                className="w-full appearance-none bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl ps-3.5 pe-9 py-2.5 text-sm text-foreground outline-none transition-all duration-200 focus:border-indigo-500/70 focus:ring-2 focus:ring-indigo-500/30 hover:border-[var(--border-hover)] cursor-pointer"
              >
                <option value="EMPLOYEE">{t('auth.roleEmployeeOption')}</option>
                <option value="IT_SUPPORT">{t('auth.roleITSupportOption')}</option>
              </select>
              <ChevronDown className="absolute end-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            </div>

            {/* Role description chip */}
            <AnimatePresence mode="wait">
              <motion.p
                key={selectedRole}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                transition={{ duration: 0.18 }}
                className="mt-1.5 text-[11px] text-muted-foreground text-start"
              >
                {selectedRole === 'IT_SUPPORT' ? (
                  <>{t('auth.roleITSupportNote')}</>
                ) : (
                  <>{t('auth.roleEmployeeNote')}</>
                )}
              </motion.p>
            </AnimatePresence>

            {state?.fieldErrors?.role && (
              <p className="mt-1.5 text-xs text-red-400 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                {t('auth.registerErrors.role')}
              </p>
            )}
          </div>

          {/* Generic error */}
          {state?.error && (
            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-red-500/10 border border-red-500/25 text-red-500 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{t(`auth.errors.${state.error}`, { minutes: state.retryAfterMinutes ?? 0 })}</span>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={pending}
            className="group relative w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {pending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{t('auth.creatingAccount')}</span>
              </>
            ) : (
              <>
                <span>{t('auth.requestAccountAccess')}</span>
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5 rtl:rotate-180" />
              </>
            )}
          </button>

          {/* Link to login */}
          <p className="text-center text-xs text-muted-foreground pt-2">
            {t('auth.alreadyHaveAccount')}{' '}
            <Link
              href="/login"
              className="text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 font-medium transition-colors"
            >
              {t('auth.signIn')}
            </Link>
          </p>
        </motion.form>
      </div>
    </div>
  )
}
