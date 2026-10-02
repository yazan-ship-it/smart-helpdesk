import { getAppSettings } from '@/lib/settings'
import { getDemoAccounts } from '@/lib/demo'
import { SESSION_END_REASONS } from '@/lib/session-check'
import LoginClient from './LoginClient'

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ reason?: string }> }) {
  const [settings, { reason }] = await Promise.all([getAppSettings(), searchParams])
  return (
    <LoginClient
      supportEmail={settings?.supportEmail ?? 'support@company.com'}
      demoAccounts={getDemoAccounts()}
      // Set by the proxy when it ends a session, e.g. after the account was suspended
      endReason={SESSION_END_REASONS.find((r) => r === reason)}
    />
  )
}
