'use client'

import { LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function LogoutButton() {
  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => null)
    window.location.href = '/login'
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className="h-9 w-9"
      aria-label="Logout"
      title="Logout"
      onClick={logout}
    >
      <LogOut className="h-4 w-4" />
    </Button>
  )
}
