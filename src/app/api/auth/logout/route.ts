import { NextRequest, NextResponse } from 'next/server'
import { AUTH_COOKIE_NAME } from '@/lib/auth/session'

function isHttpsRequest(request: NextRequest) {
  return request.nextUrl.protocol === 'https:' || request.headers.get('x-forwarded-proto') === 'https'
}

export async function POST(request: NextRequest) {
  const response = NextResponse.json({ ok: true })
  response.cookies.set(AUTH_COOKIE_NAME, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: isHttpsRequest(request),
    path: '/',
    maxAge: 0,
  })

  return response
}
