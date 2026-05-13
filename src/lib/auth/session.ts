export const AUTH_COOKIE_NAME = 'rmc_session'
export const AUTH_SESSION_SECONDS = 8 * 60 * 60

type AuthConfig =
  | {
      configured: true
      user: string
      password: string
      secret: string
    }
  | {
      configured: false
    }

type SessionPayload = {
  user: string
  exp: number
}

export function getAuthConfig(): AuthConfig {
  const user = process.env.RMC_AUTH_USER?.trim()
  const password = process.env.RMC_AUTH_PASSWORD?.trim()
  const secret = process.env.RMC_AUTH_SECRET?.trim()

  if (!user || !password || !secret) {
    return { configured: false }
  }

  return { configured: true, user, password, secret }
}

function base64UrlEncode(input: string | Uint8Array) {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input
  let binary = ''

  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function base64UrlDecode(input: string) {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(input.length / 4) * 4, '=')
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }

  return bytes
}

async function sign(value: string, secret: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value))

  return base64UrlEncode(new Uint8Array(signature))
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false

  let result = 0
  for (let index = 0; index < a.length; index += 1) {
    result |= a.charCodeAt(index) ^ b.charCodeAt(index)
  }

  return result === 0
}

export async function createSessionToken(user: string, secret: string, now = Date.now()) {
  const payload: SessionPayload = {
    user,
    exp: now + AUTH_SESSION_SECONDS * 1000,
  }
  const encodedPayload = base64UrlEncode(JSON.stringify(payload))
  const signature = await sign(encodedPayload, secret)

  return `${encodedPayload}.${signature}`
}

export async function verifySessionToken(token: string | undefined | null, secret: string, now = Date.now()) {
  if (!token) return false

  const [encodedPayload, signature, extra] = token.split('.')
  if (!encodedPayload || !signature || extra) return false

  const expectedSignature = await sign(encodedPayload, secret)
  if (!timingSafeEqual(signature, expectedSignature)) return false

  try {
    const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(encodedPayload))) as Partial<SessionPayload>
    return typeof payload.user === 'string' && typeof payload.exp === 'number' && payload.exp > now
  } catch {
    return false
  }
}
