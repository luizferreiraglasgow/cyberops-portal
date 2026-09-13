'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Navbar } from '@/components/Navbar'

const GATEWAY = 'https://mcp.cyberopsplatform.co.uk'

function parseNmap(xml: string): string {
  if (!xml) return ''
  const hostUp = /<status state="up"/.test(xml)
  const ports = Array.from(xml.matchAll(/<port protocol="(\w+)" portid="(\d+)"><state state="open"[^>]*\/>(?:<service ([^>]*?)\/?>)?/g))
  const lines = ports.map(m => {
    const attrs = m[3] || ''
    const name = /name="([^"]*)"/.exec(attrs)?.[1] || ''
    const product = /product="([^"]*)"/.exec(attrs)?.[1] || ''
    const version = /version="([^"]*)"/.exec(attrs)?.[1] || ''
    return `${m[2]}/${m[1]}  open  ${[name, product, version].filter(Boolean).join(' ')}`.trim()
  })
  if (!hostUp) return 'Host down / no response.'
  return lines.length ? lines.join('\n') : 'Host up — no open ports in the scanned range.'
}

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

function NmapPanel() {
  const [target, setTarget] = useState('')
  const [ports, setPorts] = useState('1-1000')
  const [loading, setLoading] = useState(false)
  const [out, setOut] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  async function run() {
    if (!target.trim()) return
    setLoading(true); setOut(null); setError(null)
    try {
      const res = await fetch(`${GATEWAY}/mcp/nmap`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: target.trim(), ports: ports.trim() || '1-1000', scan_type: '-sV' }),
      })
      if (res.status === 401) { setError('Gateway requires an auth token for nmap (MCP_AUTH_TOKEN is set). Unset it on the gateway to enable this panel.'); return }
      const json = await res.json()
      if (json.raw_xml !== undefined) setOut(parseNmap(json.raw_xml) || json.stderr || 'No output')
      else setError(json.error ?? json.detail ?? 'Gateway error')
    } catch { setError('Could not reach the MCP gateway') } finally { setLoading(false) }
  }
  return (
    <div className="cyber-card p-6">
      <div className="flex items-center gap-3 mb-4">
        <span style={{ fontSize: '1.5rem' }}>📡</span>
        <div>
          <h2 className="font-semibold" style={{ color: '#00d4ff' }}>Nmap</h2>
          <p className="text-xs" style={{ color: '#64748b' }}>Port scan via MCP gateway</p>
        </div>
      </div>
      <div className="flex gap-2 mb-2">
        <input className="cyber-input" placeholder="target (IP / host)" value={target} onChange={e => setTarget(e.target.value)} onKeyDown={e => e.key === 'Enter' && run()} />
      </div>
      <div className="flex gap-2">
        <input className="cyber-input" placeholder="ports (e.g. 1-1000)" value={ports} onChange={e => setPorts(e.target.value)} style={{ maxWidth: 160 }} />
        <button className="cyber-btn whitespace-nowrap" onClick={run} disabled={loading}>Scan</button>
      </div>
      <ResultBox label="Result" data={out} loading={loading} error={error} />
    </div>
  )
}

function StrixPanel() {
  const [target, setTarget] = useState('')
  const [flags, setFlags] = useState('')
  const [loading, setLoading] = useState(false)
  const [out, setOut] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  async function run() {
    if (!target.trim()) return
    setLoading(true); setOut(null); setError(null)
    try {
      const res = await fetch(`${GATEWAY}/mcp/strix`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: target.trim(), flags: flags.trim() }),
      })
      const json = await res.json()
      if (json.status === 'error' && !json.stdout) setError(json.stderr || json.error || 'STRIX failed on node-02')
      else setOut(json.stdout || json.stderr || 'No output')
    } catch { setError('Could not reach the MCP gateway') } finally { setLoading(false) }
  }
  return (
    <div className="cyber-card p-6">
      <div className="flex items-center gap-3 mb-4">
        <span style={{ fontSize: '1.5rem' }}>🤖</span>
        <div>
          <h2 className="font-semibold" style={{ color: '#00d4ff' }}>STRIX</h2>
          <p className="text-xs" style={{ color: '#64748b' }}>AI pentest agent — node-02 (can take minutes)</p>
        </div>
      </div>
      <div className="flex gap-2 mb-2">
        <input className="cyber-input" placeholder="target (URL / path)" value={target} onChange={e => setTarget(e.target.value)} onKeyDown={e => e.key === 'Enter' && run()} />
      </div>
      <div className="flex gap-2">
        <input className="cyber-input" placeholder="flags (optional)" value={flags} onChange={e => setFlags(e.target.value)} style={{ maxWidth: 200 }} />
        <button className="cyber-btn whitespace-nowrap" onClick={run} disabled={loading}>Run</button>
      </div>
      <ResultBox label="Output" data={out} loading={loading} error={error} />
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
          <p style={{ color: '#64748b', fontSize: '0.875rem' }}>Threat intel & live scanning — AbuseIPDB · VirusTotal · Shodan · Nmap · STRIX</p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <AbuseIPDBPanel />
          <VirusTotalPanel />
          <ShodanPanel />
          <NmapPanel />
          <StrixPanel />
        </div>
      </main>
    </>
  )
}
