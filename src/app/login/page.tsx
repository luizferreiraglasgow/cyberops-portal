'use client'

import { signIn, useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function LoginPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (session) router.push('/')
  }, [session, router])

  if (status === 'loading') {
    return (
      <div
        className="flex items-center justify-center min-h-screen"
        style={{ background: '#0a0e1a' }}
      >
        <div style={{ color: '#00d4ff', fontFamily: 'monospace' }}>Loading…</div>
      </div>
    )
  }

  return (
    <div
      className="flex items-center justify-center min-h-screen"
      style={{ background: '#0a0e1a' }}
    >
      <div
        className="cyber-card p-10 w-full max-w-sm text-center"
        style={{ boxShadow: '0 0 40px rgba(0, 212, 255, 0.08)' }}
      >
        <div className="mb-6">
          <span style={{ fontSize: '3rem' }}>🛡️</span>
          <h1
            className="text-2xl font-bold mt-3 mb-1"
            style={{ color: '#00d4ff', fontFamily: 'monospace' }}
          >
            CyberOps
          </h1>
          <p className="text-sm" style={{ color: '#64748b' }}>Security Operations Portal</p>
        </div>
        <button
          onClick={() => signIn('authentik', { callbackUrl: '/' })}
          className="cyber-btn w-full flex items-center justify-center gap-2 py-3"
          style={{ fontSize: '0.95rem' }}
        >
          <span>🔐</span>
          Sign in with Authentik
        </button>
        <p className="mt-6 text-xs" style={{ color: '#334155' }}>
          Protected by Authentik SSO · TOTP required
        </p>
      </div>
    </div>
  )
}
