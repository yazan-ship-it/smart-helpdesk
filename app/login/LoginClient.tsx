'use client'

import { useActionState, useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  Shield,
  User,
  ShieldCheck,
  AlertCircle,
  Loader2,
  LifeBuoy,
} from 'lucide-react'
import { toast } from 'sonner'
import { login, type AuthState } from '@/app/actions/auth'
import ThemeSwitcher from '@/app/components/ThemeSwitcher'
import LanguageSwitcher from '@/app/components/LanguageSwitcher'
import { useTranslation } from '@/lib/i18n'
import type { DemoAccount } from '@/lib/demo'
import type { SessionEndReason } from '@/lib/session-check'

const DEMO_STYLE = {
  EMPLOYEE: { Icon: User, color: 'bg-purple-500/10 text-purple-600 dark:text-purple-400', role: 'roles.employee' },
  IT_SUPPORT: { Icon: Shield, color: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400', role: 'roles.itSupport' },
  ADMIN: { Icon: ShieldCheck, color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400', role: 'roles.admin' },
} as const
const DEMO_NAME = { alice: 'auth.employeeName', bob: 'auth.itBobName', mike: 'auth.itMikeName', admin: 'auth.adminName' } as const

export default function LoginClient({
  supportEmail,
  demoAccounts,
  endReason,
}: {
  supportEmail: string
  demoAccounts: DemoAccount[]
  endReason?: SessionEndReason
}) {
  const [state, action, pending] = useActionState<AuthState, FormData>(login, undefined)
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [emailError, setEmailError] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [shakeTrigger, setShakeTrigger] = useState(0)
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)
  const [showForgotHelp, setShowForgotHelp] = useState(false)
  const [isAutoSubmitting, setIsAutoSubmitting] = useState(false)
  const [activeDemoRole, setActiveDemoRole] = useState<DemoAccount['key'] | null>(null)
  
  const formRef = useRef<HTMLFormElement>(null)
  const emailInputRef = useRef<HTMLInputElement>(null)
  const passwordInputRef = useRef<HTMLInputElement>(null)

  // Trigger error toast on failed submission
  useEffect(() => {
    if (state?.error) {
      toast.error(t(`auth.errors.${state.error}`))
    }
  }, [state?.error, t])

  // Client-side validation before submission
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    if (isAutoSubmitting) {
      return
    }

    let hasError = false
    let firstInvalid: 'email' | 'password' | null = null

    const trimmedEmail = email.trim()
    if (!trimmedEmail) {
      setEmailError(t('auth.emailRequired'))
      hasError = true
      if (!firstInvalid) firstInvalid = 'email'
    } else if (!/\S+@\S+\.\S+/.test(trimmedEmail)) {
      setEmailError(t('auth.emailInvalid'))
      hasError = true
      if (!firstInvalid) firstInvalid = 'email'
    } else {
      setEmailError('')
    }

    if (!password) {
      setPasswordError(t('auth.passwordRequired'))
      hasError = true
      if (!firstInvalid) firstInvalid = 'password'
    } else {
      setPasswordError('')
    }

    if (hasError) {
      e.preventDefault()
      setShakeTrigger((prev) => prev + 1)
      if (firstInvalid === 'email') {
        emailInputRef.current?.focus()
      } else if (firstInvalid === 'password') {
        passwordInputRef.current?.focus()
      }
    }
  }

  // 1-Click Interactive Demo Login with 200ms auto-submit
  const handleQuickLogin = (account: DemoAccount) => {
    setEmailError('')
    setPasswordError('')
    setActiveDemoRole(account.key)
    setEmail(account.email)
    setPassword(account.password)
    setIsAutoSubmitting(true)
    toast.info(`${t(DEMO_NAME[account.key])}…`)

    setTimeout(() => {
      formRef.current?.requestSubmit()
    }, 200)
  }

  const isWorking = pending || isAutoSubmitting

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative font-sans">
      {/* Language & Theme Switcher anchored cleanly at top right / end */}
      <div className="fixed top-6 end-6 z-50 flex items-center gap-2">
        <LanguageSwitcher />
        <ThemeSwitcher />
      </div>

      {/* Frameless (Borderless) Centered Container */}
      <div className="w-full max-w-lg px-6 py-10 bg-transparent flex flex-col items-center">
        {/* Brand / Header */}
        <div className="flex items-center gap-3">
          <LifeBuoy className="w-9 h-9 text-indigo-500 shrink-0" />
          <div className="text-start">
            <span className="text-xl font-bold tracking-tight text-foreground block leading-tight">
              {t('brand.name')}
            </span>
            <span className="text-sm text-muted-foreground mt-0.5 block leading-tight">
              {t('brand.subTitle')}
            </span>
          </div>
        </div>

        {/* Main Heading */}
        <div className="text-center mb-8">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground mt-6 text-center">
            {t('auth.welcomeBack')}
          </h1>
          <p className="text-base text-muted-foreground mt-2 text-center">
            {t(demoAccounts.length > 0 ? 'auth.loginSubtitle' : 'auth.loginSubtitleNoDemo')}
          </p>
        </div>

        {/* Credentials Form */}
        <motion.form
          key={shakeTrigger}
          ref={formRef}
          action={action}
          onSubmit={handleSubmit}
          noValidate
          animate={
            shakeTrigger > 0 || state?.error
              ? { x: [-8, 8, -6, 6, -3, 3, 0] }
              : {}
          }
          transition={{ duration: 0.35 }}
          className="w-full space-y-5"
        >
          {/* Top Error Callout Banner (GitHub Style) */}
          {(emailError || passwordError) ? (
            <div className="bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50 rounded-xl p-3 text-sm flex items-center gap-2 mb-4 animate-in fade-in slide-in-from-top-1 duration-150">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{t('auth.fillRequiredFields')}</span>
            </div>
          ) : state?.error ? (
            <div className="bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50 rounded-xl p-3 text-sm flex items-center gap-2 mb-4 animate-in fade-in slide-in-from-top-1 duration-150">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{t(`auth.errors.${state.error}`)}</span>
            </div>
          ) : endReason ? (
            <div role="status" className="bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900/50 rounded-xl p-3 text-sm flex items-center gap-2 mb-4">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-500" />
              <span>{t(`auth.errors.${endReason}`)}</span>
            </div>
          ) : null}

          {/* Email Field */}
          <div>
            <label
              htmlFor="email"
              className="text-sm font-semibold text-foreground mb-1.5 block text-start"
            >
              {t('auth.workEmail')}
            </label>
            <div className="relative">
              <Mail className="absolute start-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none z-10" />
              <input
                ref={emailInputRef}
                id="email"
                name="email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  if (emailError) setEmailError('')
                }}
                autoComplete="email"
                placeholder={t('auth.emailPlaceholder')}
                className={`w-full h-13 text-base ps-12 pe-4 rounded-xl border bg-background/50 focus:bg-background focus:ring-2 text-foreground placeholder:text-muted-foreground outline-none transition-all ${
                  emailError
                    ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/20'
                    : 'border-border/80 focus:border-primary/70 focus:ring-primary/40'
                }`}
              />
            </div>
            {emailError && (
              <p className="flex items-center gap-1.5 text-xs font-medium text-rose-600 dark:text-rose-400 mt-1.5 animate-in fade-in slide-in-from-top-1 duration-150">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                {emailError}
              </p>
            )}
          </div>

          {/* Password Field */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="password"
                className="text-sm font-semibold text-foreground"
              >
                {t('auth.password')}
              </label>
              <button
                type="button"
                onClick={() => setShowForgotHelp((v) => !v)}
                aria-expanded={showForgotHelp}
                className="text-xs text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 font-medium transition-colors cursor-pointer"
              >
                {t('auth.forgotPassword')}
              </button>
            </div>
            <div className="relative">
              <Lock className="absolute start-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none z-10" />
              <input
                ref={passwordInputRef}
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  if (passwordError) setPasswordError('')
                }}
                autoComplete="current-password"
                placeholder={t('auth.passwordPlaceholder')}
                className={`w-full h-13 text-base ps-12 pe-12 rounded-xl border bg-background/50 focus:bg-background focus:ring-2 text-foreground placeholder:text-muted-foreground outline-none transition-all ${
                  passwordError
                    ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/20'
                    : 'border-border/80 focus:border-primary/70 focus:ring-primary/40'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute end-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                tabIndex={-1}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            {passwordError && (
              <p className="flex items-center gap-1.5 text-xs font-medium text-rose-600 dark:text-rose-400 mt-1.5 animate-in fade-in slide-in-from-top-1 duration-150">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                {passwordError}
              </p>
            )}
            {showForgotHelp && (
              <p className="mt-2 text-xs text-muted-foreground bg-muted/40 border border-border rounded-xl p-3">
                {t('auth.forgotPasswordHelp')}{' '}
                <a href={`mailto:${supportEmail}`} className="font-medium text-indigo-600 dark:text-indigo-400 underline">
                  {supportEmail}
                </a>
              </p>
            )}
          </div>

          {/* Remember Me Checkbox */}
          <div className="flex items-center gap-2.5 pt-0.5">
            <input
              id="rememberMe"
              name="rememberMe"
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="w-4 h-4 rounded border-border bg-background text-primary focus:ring-primary/30 focus:ring-offset-0 cursor-pointer"
            />
            <label
              htmlFor="rememberMe"
              className="text-xs text-muted-foreground select-none cursor-pointer hover:text-foreground"
            >
              {t('auth.rememberMe')}
            </label>
          </div>

          {/* Primary Submit Button */}
          <button
            type="submit"
            disabled={isWorking}
            className="group relative w-full h-13 text-base font-semibold rounded-xl bg-primary text-primary-foreground shadow-md hover:opacity-95 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden"
          >
            {isWorking ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>{t('auth.authenticating')}</span>
              </>
            ) : (
              <>
                <span>{t('auth.signInButton')}</span>
                <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5 rtl:rotate-180" />
              </>
            )}
          </button>
        </motion.form>

        {/* 1-click demo logins, only when DEMO_MODE=true (lib/demo.ts) */}
        {demoAccounts.length > 0 && (
          <div className="w-full mt-10 pt-8 border-t border-border/70">
            <p className="text-xs font-bold tracking-wider uppercase text-muted-foreground/80 text-center mb-3">
              {t('auth.instantDemoAccess')}
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {demoAccounts.map((account) => {
                const style = DEMO_STYLE[account.role]
                const active = activeDemoRole === account.key && isWorking
                return (
                  <button
                    key={account.key}
                    type="button"
                    onClick={() => handleQuickLogin(account)}
                    disabled={isWorking}
                    className={`py-3 px-4 rounded-xl border border-border/70 hover:border-primary/50 hover:bg-muted/40 transition-all flex flex-col items-center text-center cursor-pointer ${
                      active ? 'border-primary ring-1 ring-primary/40 bg-primary/10' : 'bg-background/40'
                    }`}
                  >
                    <div className={`w-7 h-7 rounded-lg ${style.color} flex items-center justify-center mb-1.5`}>
                      {active ? <Loader2 className="w-4 h-4 animate-spin" /> : <style.Icon className="w-4 h-4" />}
                    </div>
                    <span className="text-sm font-semibold text-foreground">{t(style.role)}</span>
                    <span className="text-xs text-muted-foreground mt-0.5">{t(DEMO_NAME[account.key])}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Request Access Link */}
        <p className="text-center text-sm text-muted-foreground mt-8">
          {t('auth.dontHaveAccount')}{' '}
          <Link
            href="/register"
            className="text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 font-medium transition-colors"
          >
            {t('auth.requestAccess')}
          </Link>
        </p>
      </div>
    </div>
  )
}
