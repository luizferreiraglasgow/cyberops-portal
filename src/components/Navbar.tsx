'use client'

import { useSession, signOut } from 'next-auth/react'
import Link from 'next/link'

export function Navbar() {
  const { data: session } = useSession()
  return (
    <nav style={{ background: '#0f1629', borderBottom: '1px solid #1e3a5f', position: 'sticky', top: 0, zIndex: 50 }}>
      <div className="max-w-7xl mx-auto px-4 flex items-center justify-between" style={{ height: '60px' }}>
        <Link href="/" style={{ textDecoration: 'none' }}>
          <div className="flex items-center gap-3">
            <span style={{ fontSize: '1.25rem' }}>🛡️</span>
            <span className="font-bold text-lg tracking-wide" style={{ color: '#00d4ff', fontFamily: 'monospace' }}>CyberOps</span>
          </div>
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/" className="text-sm" style={{ color: '#94a3b8', textDecoration: 'none' }}>Home</Link>
          <Link href="/dashboard" className="text-sm" style={{ color: '#94a3b8', textDecoration: 'none' }}>Dashboard</Link>
          <Link href="/tools" className="text-sm" style={{ color: '#94a3b8', textDecoration: 'none' }}>Tools</Link>
          <Link href="/scope-analyzer" className="text-sm" style={{ color: '#94a3b8', textDecoration: 'none' }}>Scope Analyzer</Link>
          {session ? (
            <div className="flex items-center gap-3">
              <span className="text-sm" style={{ color: '#64748b' }}>{session.user?.name ?? session.user?.email}</span>
              <button onClick={() => signOut({ callbackUrl: '/login' })} className="text-sm px-3 py-1 rounded" style={{ background: 'transparent', border: '1px solid #1e3a5f', color: '#94a3b8', cursor: 'pointer' }}>Sign out</button>
            </div>
          ) : (
            <Link href="/login"><button className="cyber-btn text-sm">Sign in</button></Link>
          )}
        </div>
      </div>
    </nav>
  )
}
