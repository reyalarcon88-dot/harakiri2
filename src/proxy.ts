import { NextRequest, NextResponse } from 'next/server'
import { AUTH_COOKIE_NAME, getAuthConfig, verifySessionToken } from '@/lib/auth/session'

const PUBLIC_PATHS = new Set([
  '/favicon.ico',
  '/robots.txt',
  '/logo.svg',
  '/rmc-logo.png',
])

function isPublicPath(pathname: string) {
  return (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/__nextjs_font/') ||
    pathname === '/login' ||
    pathname.startsWith('/api/auth/') ||
    PUBLIC_PATHS.has(pathname)
  )
}

function loginUrl(request: NextRequest) {
  const url = request.nextUrl.clone()
  url.pathname = '/login'
  url.searchParams.set('next', `${request.nextUrl.pathname}${request.nextUrl.search}`)
  return url
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const config = getAuthConfig()
  const sessionCookie = request.cookies.get(AUTH_COOKIE_NAME)?.value
  const hasSession = config.configured
    ? await verifySessionToken(sessionCookie, config.secret)
    : false

  if (pathname === '/login' && hasSession) {
    const nextPath = request.nextUrl.searchParams.get('next') || '/'
    const safeNextPath = nextPath.startsWith('/') && !nextPath.startsWith('//') ? nextPath : '/'
    return NextResponse.redirect(new URL(safeNextPath, request.url))
  }

  if (isPublicPath(pathname)) {
    return NextResponse.next()
  }

  if (!config.configured || !hasSession) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    return NextResponse.redirect(loginUrl(request))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!.*\\..*).*)', '/api/:path*', '/uploads/:path*'],
}
