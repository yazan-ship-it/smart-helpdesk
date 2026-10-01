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

export default function LoginPage() {
  const [state, action, pending] = useActionState<AuthState, FormData>(login, undefined)
  const { t, isRTL } = useTranslation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [emailError, setEmailError] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [shakeTrigger, setShakeTrigger] = useState(0)
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)
  const [isAutoSubmitting, setIsAutoSubmitting] = useState(false)
  const [activeDemoRole, setActiveDemoRole] = useState<'alice' | 'bob' | 'mike' | 'admin' | null>(null)
  
  const formRef = useRef<HTMLFormElement>(null)
  const emailInputRef = useRef<HTMLInputElement>(null)
  const passwordInputRef = useRef<HTMLInputElement>(null)

  // Trigger error toast on failed submission
  useEffect(() => {
    if (state?.error) {
      toast.error(state.error)
    }
  }, [state?.error])

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
  const handleQuickLogin = (
    demoEmail: string,
    demoPass: string,
    roleName: string,
    roleKey: 'alice' | 'bob' | 'mike' | 'admin'
  ) => {
    setEmailError('')
    setPasswordError('')
    setActiveDemoRole(roleKey)
    setEmail(demoEmail)
    setPassword(demoPass)
    setIsAutoSubmitting(true)
    toast.info(`${roleName}…`)

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
            {t('auth.loginSubtitle')}
          </p>
        </div>

        {/* OAuth / Social Buttons */}
        <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              toast.info(isRTL ? 'تسجيل الدخول عبر Google معطل في الوضع التجريبي. يرجى استخدام أزرار الدخول السريع أدناه.' : 'Google SSO is disabled in demo mode. Please use the 1-click Demo buttons below.')
            }}
            className="flex items-center justify-center gap-3 w-full h-12 text-base font-medium rounded-xl border border-border/80 bg-background hover:bg-muted/50 transition-colors shadow-sm cursor-pointer"
          >
            {/* Official Google 4-Color Icon */}
            <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>{t('auth.googleSSO')}</span>
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              toast.info(isRTL ? 'تسجيل الدخول عبر GitHub معطل في الوضع التجريبي. يرجى استخدام أزرار الدخول السريع أدناه.' : 'GitHub SSO is disabled in demo mode. Please use the 1-click Demo buttons below.')
            }}
            className="flex items-center justify-center gap-3 w-full h-12 text-base font-medium rounded-xl border border-border/80 bg-background hover:bg-muted/50 transition-colors shadow-sm cursor-pointer"
          >
            {/* Official GitHub Octocat Icon */}
            <svg className="w-5 h-5 shrink-0 fill-current text-foreground" viewBox="0 0 24 24">
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
              />
            </svg>
            <span>{t('auth.githubSSO')}</span>
          </button>
        </div>

        {/* Divider */}
        <div className="w-full relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border/80" />
          </div>
          <div className="relative flex justify-center text-xs uppercase tracking-wider">
            <span className="bg-background px-4 text-muted-foreground font-medium">
              {t('auth.orSignInWithEmail')}
            </span>
          </div>
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
              <span>{state.error}</span>
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
                onClick={(e) => {
                  e.preventDefault()
                  toast.info(isRTL ? 'في هذا العرض التجريبي، يرجى استخدام بيانات الاعتماد الموضحة أدناه.' : 'For this demo, use credentials listed below.')
                }}
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

        {/* 1-Click Instant Demo Access Section */}
        <div className="w-full mt-10 pt-8 border-t border-border/70">
          <p className="text-xs font-bold tracking-wider uppercase text-muted-foreground/80 text-center mb-3">
            {t('auth.instantDemoAccess')}
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Employee (Alice) */}
            <button
              type="button"
              onClick={() =>
                handleQuickLogin('alice@company.com', 'employee123', `${t('roles.employee')} (${t('auth.employeeName')})`, 'alice')
              }
              disabled={isWorking}
              className={`py-3 px-4 rounded-xl border border-border/70 hover:border-primary/50 hover:bg-muted/40 transition-all flex flex-col items-center text-center cursor-pointer ${
                activeDemoRole === 'alice' && isWorking
                  ? 'border-primary ring-1 ring-primary/40 bg-primary/10'
                  : 'bg-background/40'
              }`}
            >
              <div className="w-7 h-7 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center mb-1.5">
                {activeDemoRole === 'alice' && isWorking ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <User className="w-4 h-4" />
                )}
              </div>
              <span className="text-sm font-semibold text-foreground">{t('roles.employee')}</span>
              <span className="text-xs text-muted-foreground mt-0.5">{t('auth.employeeName')}</span>
            </button>

            {/* IT Support (Bob) */}
            <button
              type="button"
              onClick={() =>
                handleQuickLogin('bob@company.com', 'support123', `${t('roles.itSupport')} (${t('auth.itBobName')})`, 'bob')
              }
              disabled={isWorking}
              className={`py-3 px-4 rounded-xl border border-border/70 hover:border-primary/50 hover:bg-muted/40 transition-all flex flex-col items-center text-center cursor-pointer ${
                activeDemoRole === 'bob' && isWorking
                  ? 'border-primary ring-1 ring-primary/40 bg-primary/10'
                  : 'bg-background/40'
              }`}
            >
              <div className="w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-1.5">
                {activeDemoRole === 'bob' && isWorking ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Shield className="w-4 h-4" />
                )}
              </div>
              <span className="text-sm font-semibold text-foreground">{t('roles.itSupport')}</span>
              <span className="text-xs text-muted-foreground mt-0.5">{t('auth.itBobName')}</span>
            </button>

            {/* IT Support (Mike) */}
            <button
              type="button"
              onClick={() =>
                handleQuickLogin('mike@company.com', 'support123', `${t('roles.itSupport')} (${t('auth.itMikeName')})`, 'mike')
              }
              disabled={isWorking}
              className={`py-3 px-4 rounded-xl border border-border/70 hover:border-primary/50 hover:bg-muted/40 transition-all flex flex-col items-center text-center cursor-pointer ${
                activeDemoRole === 'mike' && isWorking
                  ? 'border-primary ring-1 ring-primary/40 bg-primary/10'
                  : 'bg-background/40'
              }`}
            >
              <div className="w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-1.5">
                {activeDemoRole === 'mike' && isWorking ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Shield className="w-4 h-4" />
                )}
              </div>
              <span className="text-sm font-semibold text-foreground">{t('roles.itSupport')}</span>
              <span className="text-xs text-muted-foreground mt-0.5">{t('auth.itMikeName')}</span>
            </button>

            {/* Admin */}
            <button
              type="button"
              onClick={() =>
                handleQuickLogin('admin@company.com', 'admin123', t('auth.adminName'), 'admin')
              }
              disabled={isWorking}
              className={`py-3 px-4 rounded-xl border border-border/70 hover:border-primary/50 hover:bg-muted/40 transition-all flex flex-col items-center text-center cursor-pointer ${
                activeDemoRole === 'admin' && isWorking
                  ? 'border-primary ring-1 ring-primary/40 bg-primary/10'
                  : 'bg-background/40'
              }`}
            >
              <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-1.5">
                {activeDemoRole === 'admin' && isWorking ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ShieldCheck className="w-4 h-4" />
                )}
              </div>
              <span className="text-sm font-semibold text-foreground">{t('roles.admin')}</span>
              <span className="text-xs text-muted-foreground mt-0.5">{t('auth.adminName')}</span>
            </button>
          </div>
        </div>

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
