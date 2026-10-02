import { getAppSettings } from '@/lib/settings'
import LoginClient from './LoginClient'

export default async function LoginPage() {
  const settings = await getAppSettings()
  return <LoginClient supportEmail={settings?.supportEmail ?? 'support@company.com'} />
}
