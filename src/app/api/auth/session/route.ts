import { NextRequest, NextResponse } from 'next/server'
import { AUTH_COOKIE_NAME, getAuthConfig, verifySessionToken } from '@/lib/auth/session'

export async function GET(request: NextRequest) {
  const config = getAuthConfig()
  if (!config.configured) {
    return NextResponse.json({ configured: false, authenticated: false })
  }

  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value
  const authenticated = await verifySessionToken(token, config.secret)

  return NextResponse.json({ configured: true, authenticated })
}
