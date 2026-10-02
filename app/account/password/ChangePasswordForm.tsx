'use client'

import { useActionState, useEffect } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { ArrowLeft, KeyRound, Loader2 } from 'lucide-react'
import { changePassword, type ChangePasswordState } from '@/app/actions/account'
import { useTranslation } from '@/lib/i18n'

const inputClass =
  'w-full h-11 px-4 rounded-xl border border-border bg-background text-sm text-foreground outline-none transition-colors focus:border-primary/70 focus:ring-2 focus:ring-primary/30'

export default function ChangePasswordForm({ firstLogin, homeHref }: { firstLogin: boolean; homeHref: string }) {
  const { t } = useTranslation()
  const [state, action, pending] = useActionState<ChangePasswordState, FormData>(changePassword, undefined)

  useEffect(() => {
    if (state?.success) toast.success(t('account.saved'))
  }, [state, t])

  const field = (name: string, label: string, autoComplete: string, hint?: string) => (
    <div>
      <label htmlFor={name} className="block text-sm font-semibold text-foreground mb-1.5">
        {label}
      </label>
      <input id={name} name={name} type="password" required autoComplete={autoComplete} className={inputClass} />
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  )

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-sm">
        {!firstLogin && (
          <Link href={homeHref} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-4">
            <ArrowLeft className="w-3.5 h-3.5 rtl:rotate-180" />
            {t('account.back')}
          </Link>
        )}
        <div className="flex items-center gap-3 mb-2">
          <span className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <KeyRound className="w-5 h-5" />
          </span>
          <h1 className="text-xl font-bold text-foreground">
            {firstLogin ? t('account.firstLoginTitle') : t('account.changePasswordTitle')}
          </h1>
        </div>
        <p className="text-sm text-muted-foreground mb-6">
          {firstLogin ? t('account.firstLoginIntro') : t('account.changePasswordIntro')}
        </p>

        <form action={action} className="space-y-4">
          {state?.error && (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl p-3">
              {t(`account.errors.${state.error}`)}
            </p>
          )}
          {field('currentPassword', firstLogin ? t('account.temporaryPassword') : t('account.currentPassword'), 'current-password')}
          {field('newPassword', t('account.newPassword'), 'new-password', t('account.passwordHint'))}
          {field('confirmPassword', t('account.confirmPassword'), 'new-password')}
          <button
            type="submit"
            disabled={pending}
            className="w-full h-11 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 inline-flex items-center justify-center gap-2 cursor-pointer"
          >
            {pending && <Loader2 className="w-4 h-4 animate-spin" />}
            {pending ? t('account.saving') : t('account.save')}
          </button>
        </form>
      </div>
    </main>
  )
}
