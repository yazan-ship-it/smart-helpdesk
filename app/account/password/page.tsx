import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import ChangePasswordForm from './ChangePasswordForm'

export const metadata = { title: 'Change password' }

export default async function ChangePasswordPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  return (
    <ChangePasswordForm
      firstLogin={Boolean(session.mustChangePassword)}
      homeHref={session.role === 'ADMIN' ? '/admin/users' : '/tickets'}
    />
  )
}
