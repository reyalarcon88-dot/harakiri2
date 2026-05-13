import { NextRequest, NextResponse } from 'next/server'
import { AUTH_COOKIE_NAME, AUTH_SESSION_SECONDS, createSessionToken, getAuthConfig } from '@/lib/auth/session'

function isHttpsRequest(request: NextRequest) {
  return request.nextUrl.protocol === 'https:' || request.headers.get('x-forwarded-proto') === 'https'
}

export async function POST(request: NextRequest) {
  const config = getAuthConfig()
  if (!config.configured) {
    return NextResponse.json(
      { error: 'Autenticacion no configurada. Define RMC_AUTH_USER, RMC_AUTH_PASSWORD y RMC_AUTH_SECRET en .env.' },
      { status: 503 }
    )
  }

  const body = await request.json().catch(() => null)
  const user = String(body?.user ?? '').trim()
  const password = String(body?.password ?? '')

  if (user !== config.user || password !== config.password) {
    return NextResponse.json({ error: 'Usuario o contraseña incorrectos.' }, { status: 401 })
  }

  const token = await createSessionToken(config.user, config.secret)
  const response = NextResponse.json({ ok: true })

  response.cookies.set(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isHttpsRequest(request),
    path: '/',
    maxAge: AUTH_SESSION_SECONDS,
  })

  return response
}
