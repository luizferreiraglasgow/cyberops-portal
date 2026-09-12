'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Navbar } from '@/components/Navbar'

function ResultBox({ label, data, loading, error }: {
  label: string
  data: unknown
  loading: boolean
  error: string | null
}) {
  return (
    <div className="mt-4">
      <div className="text-xs font-mono uppercase tracking-widest mb-2" style={{ color: '#475569' }}>
        {label}
      </div>
      <div className="rounded-lg p-4 overflow-x-auto" style={{ background: '#070b14', border: '1px solid #1e3a5f', minHeight: '80px', maxHeight: '380px', overflowY: 'auto' }}>
        {loading && <span style={{ color: '#00d4ff', fontFamily: 'monospace' }}>Querying…</span>}
        {error && <span style={{ color: '#ff4444', fontFamily: 'monospace' }}>{error}</span>}
        {!loading && !error && data != null && (
          <pre style={{ color: '#00ff9d', fontFamily: 'monospace', fontSize: '0.75rem', whiteSpace: 'pre-wrap', margin: 0 }}>
            {JSON.stringify(data, null, 2)}
          </pre>
        )}
        {!loading && !error && data == null && (
          <span style={{ color: '#334155', fontFamily: 'monospace' }}>No results yet</span>
        )}
      </div>
    </div>
  )
}

function AbuseIPDBPanel() {
  const [ip, setIp] = useState('')
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<unknown>(null)
  const [error, setError] = useState<string | null>(null)
  async function query() {
    if (!ip.trim()) return
    setLoading(true); setData(null); setError(null)
    try {
      const res = await fetch(`/api/security/abuseipdb?ip=${encodeURIComponent(ip.trim())}`)
      const json = await res.json()
      if (!res.ok) setError(json.error ?? 'API error')
      else setData(json)
    } catch { setError('Network error') } finally { setLoading(false) }
  }
  return (
    <div className="cyber-card p-6">
      <div className="flex items-center gap-3 mb-4">
        <span style={{ fontSize: '1.5rem' }}>🚨</span>
        <div>
          <h2 className="font-semibold" style={{ color: '#00d4ff' }}>AbuseIPDB</h2>
          <p className="text-xs" style={{ color: '#64748b' }}>IP reputation & abuse reports</p>
        </div>
      </div>
      <div className="flex gap-2">
        <input className="cyber-input" placeholder="IP address (e.g. 1.2.3.4)" value={ip} onChange={e => setIp(e.target.value)} onKeyDown={e => e.key === 'Enter' && query()} />
        <button className="cyber-btn whitespace-nowrap" onClick={query} disabled={loading}>Check</button>
      </div>
      <ResultBox label="Result" data={data} loading={loading} error={error} />
    </div>
  )
}

function VirusTotalPanel() {
  const [value, setValue] = useState('')
  const [mode, setMode] = useState<'hash' | 'ip' | 'url'>('ip')
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<unknown>(null)
  const [error, setError] = useState<string | null>(null)
  async function query() {
    if (!value.trim()) return
    setLoading(true); setData(null); setError(null)
    try {
      const params = new URLSearchParams({ [mode]: value.trim() })
      const res = await fetch(`/api/security/virustotal?${params}`)
      const json = await res.json()
      if (!res.ok) setError(json.error ?? 'API error')
      else setData(json)
    } catch { setError('Network error') } finally { setLoading(false) }
  }
  const placeholders = { hash: 'File hash (MD5 / SHA-1 / SHA-256)', ip: 'IP address', url: 'URL to scan' }
  return (
    <div className="cyber-card p-6">
      <div className="flex items-center gap-3 mb-4">
        <span style={{ fontSize: '1.5rem' }}>🦠</span>
        <div>
          <h2 className="font-semibold" style={{ color: '#00d4ff' }}>VirusTotal</h2>
          <p className="text-xs" style={{ color: '#64748b' }}>File hash, IP & URL analysis</p>
        </div>
      </div>
      <div className="flex gap-2 mb-3">
        {(['ip', 'hash', 'url'] as const).map(m => (
          <button key={m} onClick={() => { setMode(m); setValue(''); setData(null); setError(null) }}
            className="text-xs px-3 py-1 rounded font-mono"
            style={{ background: mode === m ? '#00d4ff22' : 'transparent', border: `1px solid ${mode === m ? '#00d4ff' : '#1e3a5f'}`, color: mode === m ? '#00d4ff' : '#64748b', cursor: 'pointer' }}>
            {m.toUpperCase()}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <input className="cyber-input" placeholder={placeholders[mode]} value={value} onChange={e => setValue(e.target.value)} onKeyDown={e => e.key === 'Enter' && query()} />
        <button className="cyber-btn whitespace-nowrap" onClick={query} disabled={loading}>Scan</button>
      </div>
      <ResultBox label="Result" data={data} loading={loading} error={error} />
    </div>
  )
}

function ShodanPanel() {
  const [ip, setIp] = useState('')
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<unknown>(null)
  const [error, setError] = useState<string | null>(null)
  async function query() {
    if (!ip.trim()) return
    setLoading(true); setData(null); setError(null)
    try {
      const res = await fetch(`/api/security/shodan?ip=${encodeURIComponent(ip.trim())}`)
      const json = await res.json()
      if (!res.ok) setError(json.error ?? 'API error')
      else setData(json)
    } catch { setError('Network error') } finally { setLoading(false) }
  }
  return (
    <div className="cyber-card p-6">
      <div className="flex items-center gap-3 mb-4">
        <span style={{ fontSize: '1.5rem' }}>🌐</span>
        <div>
          <h2 className="font-semibold" style={{ color: '#00d4ff' }}>Shodan</h2>
          <p className="text-xs" style={{ color: '#64748b' }}>Open ports & exposed services</p>
        </div>
      </div>
      <div className="flex gap-2">
        <input className="cyber-input" placeholder="IP address (e.g. 1.2.3.4)" value={ip} onChange={e => setIp(e.target.value)} onKeyDown={e => e.key === 'Enter' && query()} />
        <button className="cyber-btn whitespace-nowrap" onClick={query} disabled={loading}>Lookup</button>
      </div>
      <ResultBox label="Result" data={data} loading={loading} error={error} />
    </div>
  )
}

export default function DashboardPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  useEffect(() => { if (status === 'unauthenticated') router.push('/login') }, [status, router])
  if (status === 'loading') return <div className="flex items-center justify-center min-h-screen" style={{ background: '#0a0e1a', color: '#00d4ff', fontFamily: 'monospace' }}>Loading…</div>
  if (!session) return null
  return (
    <>
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold mb-1" style={{ color: '#e2e8f0', fontFamily: 'monospace' }}>Security Dashboard</h1>
          <p style={{ color: '#64748b', fontSize: '0.875rem' }}>Real-time threat intelligence — AbuseIPDB · VirusTotal · Shodan</p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <AbuseIPDBPanel />
          <VirusTotalPanel />
          <ShodanPanel />
        </div>
      </main>
    </>
  )
}
