import { type Role } from '@/lib/session'

export function getRoleLabel(role: Role | string, locale: 'en' | 'ar' = 'en'): string {
  if (locale === 'ar') {
    switch (role) {
      case 'ADMIN':
        return 'مدير النظام'
      case 'IT_SUPPORT':
        return 'دعم فني'
      case 'EMPLOYEE':
        return 'موظف'
      default:
        return 'مستخدم'
    }
  }

  switch (role) {
    case 'ADMIN':
      return 'Admin'
    case 'IT_SUPPORT':
      return 'IT Support'
    case 'EMPLOYEE':
      return 'Employee'
    default:
      return 'User'
  }
}
