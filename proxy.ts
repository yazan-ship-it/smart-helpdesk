import { NextRequest, NextResponse } from 'next/server'
import { decrypt, SESSION_COOKIE } from '@/lib/session'

const protectedRoutes = ['/tickets', '/account']
const adminRoutes = ['/admin']
const publicRoutes = ['/login', '/register']
const PASSWORD_PAGE = '/account/password'

export default async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname
  const isProtectedRoute = protectedRoutes.some((route) => path.startsWith(route))
  const isAdminRoute = adminRoutes.some((route) => path.startsWith(route))
  const isPublicRoute = publicRoutes.some((route) => path === route || path.startsWith(route + '/'))

  const session = await decrypt(req.cookies.get(SESSION_COOKIE)?.value)
  const redirectTo = (target: string) => NextResponse.redirect(new URL(target, req.nextUrl))

  // Signed in with a temporary password: nothing else until it is replaced
  if (session?.mustChangePassword && path !== PASSWORD_PAGE && !isPublicRoute) {
    return redirectTo(PASSWORD_PAGE)
  }

  // Admin routes: must be authenticated as ADMIN
  if (isAdminRoute) {
    if (!session?.userId) return redirectTo('/login')
    if (session.role !== 'ADMIN') return redirectTo('/tickets')
  }

  // Regular protected routes: must be authenticated
  if (isProtectedRoute && !session?.userId) return redirectTo('/login')

  // Public routes: bounce authenticated users to their home
  if (isPublicRoute && session?.userId) {
    return redirectTo(session.role === 'ADMIN' ? '/admin/users' : '/tickets')
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|.*\\.png$).*)'],
}
