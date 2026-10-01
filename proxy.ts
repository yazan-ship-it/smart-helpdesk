import { NextRequest, NextResponse } from 'next/server'
import { decrypt } from '@/lib/session'
import { cookies } from 'next/headers'

const protectedRoutes = ['/tickets']
const adminRoutes = ['/admin']
const publicRoutes = ['/login', '/register']

export default async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname
  const isProtectedRoute = protectedRoutes.some((route) => path.startsWith(route))
  const isAdminRoute = adminRoutes.some((route) => path.startsWith(route))
  const isPublicRoute = publicRoutes.some((route) => path === route || path.startsWith(route + '/'))

  const cookieStore = await cookies()
  const cookie = cookieStore.get('helpdesk-session')?.value
  const session = await decrypt(cookie)

  // Admin routes: must be authenticated as ADMIN
  if (isAdminRoute) {
    if (!session?.userId) {
      return NextResponse.redirect(new URL('/login', req.nextUrl))
    }
    if (session.role !== 'ADMIN') {
      return NextResponse.redirect(new URL('/tickets', req.nextUrl))
    }
  }

  // Regular protected routes: must be authenticated
  if (isProtectedRoute && !session?.userId) {
    return NextResponse.redirect(new URL('/login', req.nextUrl))
  }

  // Public routes: bounce authenticated users to their home
  if (isPublicRoute && session?.userId) {
    if (session.role === 'ADMIN') {
      return NextResponse.redirect(new URL('/admin/users', req.nextUrl))
    }
    return NextResponse.redirect(new URL('/tickets', req.nextUrl))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|.*\\.png$).*)'],
}
