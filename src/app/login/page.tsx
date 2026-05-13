'use client'

import { FormEvent, Suspense, useState } from 'react'
import Image from 'next/image'
import { useSearchParams } from 'next/navigation'
import { AlertTriangle, Loader2, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

function LoginForm() {
  const searchParams = useSearchParams()
  const [user, setUser] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user, password }),
      })
      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        setError(payload?.error || 'No se pudo iniciar sesion.')
        return
      }

      const nextPath = searchParams.get('next') || '/'
      window.location.href = nextPath.startsWith('/') && !nextPath.startsWith('//') ? nextPath : '/'
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="space-y-4 text-center">
          <div className="mx-auto flex justify-center">
            <Image src="/rmc-logo.png" alt="RMC" width={150} height={62} priority />
          </div>
          <div>
            <CardTitle className="flex items-center justify-center gap-2 text-xl">
              <Lock className="h-5 w-5" />
              Acceso al sistema
            </CardTitle>
            <CardDescription>Ingresa usuario y contraseña para continuar.</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={submit}>
            {error ? (
              <div className="flex gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="user">Usuario</Label>
              <Input
                id="user"
                autoComplete="username"
                value={user}
                onChange={(event) => setUser(event.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Entrar
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  )
}
