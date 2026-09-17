'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Navbar } from '@/components/Navbar'

type Profile = 'awareness' | 'blackbox' | 'adversary'

const profiles: { id: Profile; label: string; caps: string[] }[] = [
  { id: 'awareness', label: 'Awareness', caps: ['Email', 'SMS', 'Reporting telemetry'] },
  { id: 'blackbox', label: 'Black-Box', caps: ['+ OSINT enrichment', '+ Target segmentation', '+ Scenario chaining'] },
  { id: 'adversary', label: 'Adversary Simulation', caps: ['+ Advanced identity interaction', 'needs Zone B feed + separate sign-off'] },
]

const label: React.CSSProperties = { color: '#64748b', fontSize: '0.72rem', fontFamily: 'monospace', display: 'block', marginBottom: 6 }

export default function NewCampaignPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [name, setName] = useState('')
  const [clientId, setClientId] = useState('')
  const [engagementId, setEngagementId] = useState('')
  const [authRef, setAuthRef] = useState('')
  const [profile, setProfile] = useState<Profile>('awareness')
  const [batchSize, setBatchSize] = useState(25)
  const [intervalSeconds, setIntervalSeconds] = useState(300)
  const [maxActive, setMaxActive] = useState(50)
  const [businessHours, setBusinessHours] = useState(true)
  const [randomization, setRandomization] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { if (status === 'unauthenticated') router.push('/login') }, [status, router])
  if (status === 'loading') return <div className="flex items-center justify-center min-h-screen" style={{ background: '#0a0e1a', color: '#00d4ff', fontFamily: 'monospace' }}>Loading…</div>
  if (!session) return null

  const canSubmit = name.trim() && clientId.trim() && engagementId.trim() && authRef.trim() && !saving

  async function create() {
    if (!canSubmit) return
    setSaving(true); setError(null)
    try {
      const res = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name, client_id: clientId, engagement_id: engagementId, authorization_ref: authRef,
          profile, batch_size: batchSize, interval_seconds: intervalSeconds, max_active: maxActive,
          business_hours: businessHours, randomization,
        }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? `Could not create the campaign (${res.status}).`); return }
      router.push(`/campaigns/${json.campaign.id}`)
    } catch {
      setError('Network error while creating the campaign.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Navbar />
      <main className="max-w-3xl mx-auto px-4 py-8">
        <div className="mb-6">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
            <span style={{ fontSize: '1.5rem' }}>🎣</span>
            <h1 className="text-2xl font-bold" style={{ color: '#e2e8f0', fontFamily: 'monospace' }}>New Campaign</h1>
            <span style={{ background: '#14b8a622', border: '1px solid #14b8a6', color: '#5eead4', borderRadius: 4, padding: '2px 8px', fontSize: '0.65rem', fontFamily: 'monospace', fontWeight: 700 }}>Social Engineering</span>
          </div>
          <p style={{ color: '#64748b', fontSize: '0.875rem' }}>Provider-owned simulation — attempt-only telemetry, no credential capture. Authorization is out-of-band (SoW + T&amp;C); its reference is recorded on the campaign.</p>
        </div>

        <div className="cyber-card p-6" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label htmlFor="c-name" style={label}>Campaign name</label>
            <input id="c-name" className="cyber-input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Q3 phishing awareness" style={{ width: '100%', fontFamily: 'monospace', fontSize: '0.85rem' }} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label htmlFor="c-client" style={label}>Client ID</label>
              <input id="c-client" className="cyber-input" value={clientId} onChange={e => setClientId(e.target.value)} placeholder="client reference" style={{ width: '100%', fontFamily: 'monospace', fontSize: '0.85rem' }} />
            </div>
            <div>
              <label htmlFor="c-eng" style={label}>Engagement ID</label>
              <input id="c-eng" className="cyber-input" value={engagementId} onChange={e => setEngagementId(e.target.value)} placeholder="engagement reference" style={{ width: '100%', fontFamily: 'monospace', fontSize: '0.85rem' }} />
            </div>
          </div>

          <div>
            <label htmlFor="c-auth" style={label}>Authorization reference (SoW / T&amp;C)</label>
            <input id="c-auth" className="cyber-input" value={authRef} onChange={e => setAuthRef(e.target.value)} placeholder="signed SoW / T&C reference" style={{ width: '100%', fontFamily: 'monospace', fontSize: '0.85rem' }} />
            <div style={{ color: '#475569', fontSize: '0.68rem', fontFamily: 'monospace', marginTop: 4 }}>Recorded on the campaign — this is what makes the evidence pack defensible.</div>
          </div>

          <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
            <legend style={label}>Profile</legend>
            <div role="group" aria-label="Campaign profile" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {profiles.map(p => (
                <button key={p.id} type="button" aria-pressed={profile === p.id} onClick={() => setProfile(p.id)}
                  style={{ background: profile === p.id ? '#14b8a622' : 'transparent', border: `1px solid ${profile === p.id ? '#14b8a6' : '#1e3a5f'}`, color: profile === p.id ? '#5eead4' : '#64748b', borderRadius: 6, padding: '5px 12px', fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'monospace' }}>
                  {p.label}
                </button>
              ))}
            </div>
            <ul style={{ listStyle: 'none', padding: 0, margin: '10px 0 0' }}>
              {(profiles.find(p => p.id === profile)?.caps ?? []).map((c, i) => (
                <li key={i} style={{ color: '#94a3b8', fontFamily: 'monospace', fontSize: '0.72rem', lineHeight: 1.9 }}>▸ {c}</li>
              ))}
            </ul>
          </fieldset>

          <div>
            <div style={label}>Rate control</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <div>
                <label htmlFor="c-batch" style={{ ...label, fontSize: '0.68rem' }}>Batch size</label>
                <input id="c-batch" type="number" min={1} className="cyber-input" value={batchSize} onChange={e => setBatchSize(Math.max(1, Number(e.target.value) || 1))} style={{ width: '100%', fontFamily: 'monospace', fontSize: '0.85rem' }} />
              </div>
              <div>
                <label htmlFor="c-int" style={{ ...label, fontSize: '0.68rem' }}>Interval (s)</label>
                <input id="c-int" type="number" min={0} className="cyber-input" value={intervalSeconds} onChange={e => setIntervalSeconds(Math.max(0, Number(e.target.value) || 0))} style={{ width: '100%', fontFamily: 'monospace', fontSize: '0.85rem' }} />
              </div>
              <div>
                <label htmlFor="c-max" style={{ ...label, fontSize: '0.68rem' }}>Max active</label>
                <input id="c-max" type="number" min={1} className="cyber-input" value={maxActive} onChange={e => setMaxActive(Math.max(1, Number(e.target.value) || 1))} style={{ width: '100%', fontFamily: 'monospace', fontSize: '0.85rem' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button type="button" aria-pressed={businessHours} onClick={() => setBusinessHours(v => !v)}
                style={{ background: businessHours ? '#14b8a622' : 'transparent', border: `1px solid ${businessHours ? '#14b8a6' : '#1e3a5f'}`, color: businessHours ? '#5eead4' : '#64748b', borderRadius: 6, padding: '5px 12px', fontSize: '0.72rem', cursor: 'pointer', fontFamily: 'monospace' }}>{businessHours ? '☑' : '☐'} Business hours only</button>
              <button type="button" aria-pressed={randomization} onClick={() => setRandomization(v => !v)}
                style={{ background: randomization ? '#14b8a622' : 'transparent', border: `1px solid ${randomization ? '#14b8a6' : '#1e3a5f'}`, color: randomization ? '#5eead4' : '#64748b', borderRadius: 6, padding: '5px 12px', fontSize: '0.72rem', cursor: 'pointer', fontFamily: 'monospace' }}>{randomization ? '☑' : '☐'} Randomize timing</button>
            </div>
          </div>

          {error && <div role="alert" style={{ color: '#ff6b6b', fontFamily: 'monospace', fontSize: '0.78rem', padding: '8px 10px', background: '#7f1d1d22', border: '1px solid #7f1d1d', borderRadius: 6 }}>{error}</div>}

          <div style={{ display: 'flex', gap: 10 }}>
            <button className="cyber-btn" onClick={create} disabled={!canSubmit} style={{ flex: 1, padding: '12px', fontSize: '0.9rem' }}>{saving ? 'Creating…' : '🚀 Create Campaign (DRAFT)'}</button>
            <button onClick={() => router.push('/scope-analyzer')} style={{ padding: '12px 16px', fontSize: '0.85rem', fontFamily: 'monospace', borderRadius: 8, background: 'transparent', border: '1px solid #1e3a5f', color: '#64748b', cursor: 'pointer' }}>Cancel</button>
          </div>
          <div style={{ color: '#475569', fontSize: '0.68rem', fontFamily: 'monospace' }}>Creates the campaign in DRAFT. Targets, scenarios and execution (state machine, kill-switch, telemetry) are configured in the workspace.</div>
        </div>
      </main>
    </>
  )
}
