'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useParams } from 'next/navigation'
import { Navbar } from '@/components/Navbar'

interface Campaign {
  id: string
  client_id: string
  engagement_id: string
  authorization_ref: string
  name: string
  profile: string
  status: string
  batch_size: number
  interval_seconds: number
  max_active: number
  business_hours: boolean
  randomization: boolean
  start_time: string | null
  end_time: string | null
  created_at: string
}

const statusColor: Record<string, string> = {
  DRAFT: '#64748b', READY: '#3b82f6', SCHEDULED: '#3b82f6', RUNNING: '#22c55e',
  COMPLETED: '#22c55e', REPORTING: '#8b5cf6', PAUSED: '#f59e0b', STOPPED: '#f59e0b',
  ABORTED: '#ef4444', INCIDENT: '#ef4444',
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '6px 0', borderBottom: '1px solid #101a2e' }}>
      <span style={{ color: '#64748b', fontFamily: 'monospace', fontSize: '0.72rem' }}>{k}</span>
      <span style={{ color: '#cbd5e1', fontFamily: 'monospace', fontSize: '0.72rem', textAlign: 'right' }}>{v}</span>
    </div>
  )
}

export default function CampaignWorkspacePage() {
  const { data: session, status: authStatus } = useSession()
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const id = params?.id
  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true); setError(null)
    try {
      const res = await fetch(`/api/campaigns/${id}`, { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? `Could not load the campaign (${res.status}).`); setCampaign(null) }
      else setCampaign(json.campaign)
    } catch {
      setError('Network error while loading the campaign.')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { if (authStatus === 'unauthenticated') router.push('/login') }, [authStatus, router])
  useEffect(() => { if (authStatus === 'authenticated') load() }, [authStatus, load])

  if (authStatus === 'loading') return <div className="flex items-center justify-center min-h-screen" style={{ background: '#0a0e1a', color: '#00d4ff', fontFamily: 'monospace' }}>Loading…</div>
  if (!session) return null

  const sc = campaign ? statusColor[campaign.status] ?? '#64748b' : '#64748b'

  return (
    <>
      <Navbar />
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-6" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: '1.5rem' }}>🎣</span>
          <h1 className="text-2xl font-bold" style={{ color: '#e2e8f0', fontFamily: 'monospace', margin: 0 }}>{campaign?.name ?? 'Campaign'}</h1>
          {campaign && (
            <span style={{ background: `${sc}22`, border: `1px solid ${sc}`, color: sc, borderRadius: 4, padding: '2px 10px', fontSize: '0.7rem', fontFamily: 'monospace', fontWeight: 700 }}>{campaign.status}</span>
          )}
        </div>

        {loading && <div className="cyber-card p-6" style={{ color: '#00d4ff', fontFamily: 'monospace', fontSize: '0.85rem' }}>Loading campaign…</div>}
        {error && <div role="alert" className="cyber-card p-6" style={{ color: '#ff6b6b', fontFamily: 'monospace', fontSize: '0.82rem', borderColor: '#7f1d1d', lineHeight: 1.5 }}>{error}</div>}

        {campaign && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="cyber-card p-5">
              <div style={{ color: '#5eead4', fontFamily: 'monospace', fontSize: '0.75rem', fontWeight: 700, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Engagement</div>
              <Row k="Client ID" v={campaign.client_id} />
              <Row k="Engagement ID" v={campaign.engagement_id} />
              <Row k="Authorization ref" v={campaign.authorization_ref} />
              <Row k="Profile" v={campaign.profile} />
              <Row k="Created" v={new Date(campaign.created_at).toLocaleString()} />
            </div>

            <div className="cyber-card p-5">
              <div style={{ color: '#5eead4', fontFamily: 'monospace', fontSize: '0.75rem', fontWeight: 700, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Rate control</div>
              <Row k="Batch size" v={campaign.batch_size} />
              <Row k="Interval" v={`${campaign.interval_seconds}s`} />
              <Row k="Max active" v={campaign.max_active} />
              <Row k="Business hours only" v={campaign.business_hours ? 'yes' : 'no'} />
              <Row k="Randomize timing" v={campaign.randomization ? 'yes' : 'no'} />
            </div>

            <div className="cyber-card p-5" style={{ gridColumn: '1 / -1' }}>
              <div style={{ color: '#64748b', fontFamily: 'monospace', fontSize: '0.75rem', fontWeight: 700, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Telemetry</div>
              <div style={{ color: '#5eead4', fontFamily: 'monospace', fontSize: '0.72rem', lineHeight: 1.9 }}>✓ Zone A — Human layer (provider-owned, always on)</div>
              <div style={{ color: '#475569', fontFamily: 'monospace', fontSize: '0.72rem', lineHeight: 1.9 }}>○ Zone B — Defensive layer (client tenant · not connected)</div>
              <div style={{ color: '#64748b', fontFamily: 'monospace', fontSize: '0.68rem', marginTop: 6, lineHeight: 1.5 }}>Records arrival · interaction · simulated submission · report events. Never passwords, secrets or reusable credentials.</div>
            </div>

            <div className="cyber-card p-5" style={{ gridColumn: '1 / -1', borderColor: '#1e3a5f' }}>
              <div style={{ color: '#64748b', fontFamily: 'monospace', fontSize: '0.72rem', lineHeight: 1.6 }}>
                🛠 Targets, scenarios and execution (state machine DRAFT→READY→…→REPORTING, rate-controlled delivery, provider-side kill switch and Simulation Telemetry) arrive in the next build slice. Delivery is simulated — Zone A, no external egress.
              </div>
            </div>
          </div>
        )}

        <div style={{ marginTop: 16 }}>
          <button onClick={() => router.push('/scope-analyzer')} style={{ padding: '10px 16px', fontSize: '0.8rem', fontFamily: 'monospace', borderRadius: 8, background: 'transparent', border: '1px solid #1e3a5f', color: '#64748b', cursor: 'pointer' }}>← Back to Scope Analyzer</button>
        </div>
      </main>
    </>
  )
}
