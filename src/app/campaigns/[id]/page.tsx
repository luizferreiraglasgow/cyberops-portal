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
  kill_switch: Record<string, unknown>
  start_time: string | null
  end_time: string | null
  created_at: string
  gophish_campaign_id: number | null
}
interface TargetRow { id: string; target_id: string; role: string | null; department: string | null; channel: 'email' | 'sms' | null; email: string | null }
interface ScenarioRow { id: string; type: string; channel: string; difficulty: string; variant: string | null }
interface EventRow { id: string; target_id: string; event_type: string; zone: string; source: string | null; occurred_at: string }

const statusColor: Record<string, string> = {
  DRAFT: '#64748b', READY: '#3b82f6', SCHEDULED: '#3b82f6', RUNNING: '#22c55e',
  COMPLETED: '#22c55e', REPORTING: '#8b5cf6', PAUSED: '#f59e0b', STOPPED: '#f59e0b',
  ABORTED: '#ef4444', INCIDENT: '#ef4444',
}

// Per-status enabled transitions (mirrors the backend graph — 409 in backend catches drift)
const NEXT: Record<string, { to: string; label: string; danger?: boolean }[]> = {
  DRAFT:     [{ to: 'READY', label: 'Mark Ready' }, { to: 'ABORTED', label: 'Abort', danger: true }],
  READY:     [{ to: 'SCHEDULED', label: 'Schedule' }, { to: 'DRAFT', label: 'Back to Draft' }, { to: 'ABORTED', label: 'Abort', danger: true }],
  SCHEDULED: [{ to: 'RUNNING', label: 'Start' }, { to: 'READY', label: 'Unschedule' }, { to: 'ABORTED', label: 'Abort', danger: true }],
  RUNNING:   [{ to: 'PAUSED', label: 'Pause' }, { to: 'COMPLETED', label: 'Complete' }, { to: 'STOPPED', label: 'Stop' }, { to: 'ABORTED', label: 'Abort', danger: true }],
  PAUSED:    [{ to: 'RUNNING', label: 'Resume' }, { to: 'STOPPED', label: 'Stop' }, { to: 'ABORTED', label: 'Abort', danger: true }],
  STOPPED:   [{ to: 'REPORTING', label: 'Move to Reporting' }, { to: 'ABORTED', label: 'Abort', danger: true }],
  ABORTED:   [{ to: 'REPORTING', label: 'Move to Reporting' }],
  INCIDENT:  [{ to: 'PAUSED', label: 'Pause' }, { to: 'STOPPED', label: 'Stop' }, { to: 'ABORTED', label: 'Abort', danger: true }],
  COMPLETED: [{ to: 'REPORTING', label: 'Move to Reporting' }],
  REPORTING: [],
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '6px 0', borderBottom: '1px solid #101a2e' }}>
      <span style={{ color: '#64748b', fontFamily: 'monospace', fontSize: '0.72rem' }}>{k}</span>
      <span style={{ color: '#cbd5e1', fontFamily: 'monospace', fontSize: '0.72rem', textAlign: 'right' }}>{v}</span>
    </div>
  )
}
const cardHeader: React.CSSProperties = { color: '#5eead4', fontFamily: 'monospace', fontSize: '0.75rem', fontWeight: 700, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }
const labelSm: React.CSSProperties = { color: '#64748b', fontSize: '0.68rem', fontFamily: 'monospace', display: 'block', marginBottom: 4 }

export default function CampaignWorkspacePage() {
  const { data: session, status: authStatus } = useSession()
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const id = params?.id

  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [targets, setTargets] = useState<TargetRow[]>([])
  const [scenarios, setScenarios] = useState<ScenarioRow[]>([])
  const [events, setEvents] = useState<EventRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [deliveryProvider, setDeliveryProvider] = useState<{ value: string; updated_at: string; reported_by: string | null } | null>(null)
  useEffect(() => {
    fetch('/api/system/status', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then(j => setDeliveryProvider(j?.status ?? null))
      .catch(() => {})
  }, [])
  const [busy, setBusy] = useState(false)

  // Targets form
  const [segment, setSegment] = useState('')
  const [bulkText, setBulkText] = useState('')

  // Scenario form
  const [scType, setScType] = useState('m365-alert')
  const [scChannel, setScChannel] = useState<'email' | 'sms'>('email')
  const [scDifficulty, setScDifficulty] = useState<'least' | 'moderate' | 'most'>('moderate')
  const [scVariant, setScVariant] = useState('A')

  // Kill switch form
  const [ksReport, setKsReport] = useState<string>('')
  const [ksLanding, setKsLanding] = useState<string>('')

  const reload = useCallback(async (signal?: AbortSignal) => {
    if (!id) return
    try {
      const [c, t, s, e] = await Promise.all([
        fetch(`/api/campaigns/${id}`, { cache: 'no-store', signal }),
        fetch(`/api/campaigns/${id}/targets`, { cache: 'no-store', signal }),
        fetch(`/api/campaigns/${id}/scenarios`, { cache: 'no-store', signal }),
        fetch(`/api/campaigns/${id}/events?limit=100`, { cache: 'no-store', signal }),
      ])
      if (!c.ok) {
        const j = await c.json().catch(() => ({}))
        setError((j as { error?: string }).error ?? `Could not load the campaign (${c.status}).`)
        return
      }
      const cj = await c.json(); const tj = await t.json(); const sj = await s.json(); const ej = await e.json()
      setCampaign(cj.campaign); setTargets(tj.targets ?? []); setScenarios(sj.scenarios ?? []); setEvents(ej.events ?? [])
      // Prefill kill-switch inputs from stored config the first time we see them
      const ks = cj.campaign?.kill_switch ?? {}
      if (typeof ks.report_threshold === 'number' && ksReport === '') setKsReport(String(ks.report_threshold))
      if (typeof ks.landing_volume_per_minute === 'number' && ksLanding === '') setKsLanding(String(ks.landing_volume_per_minute))
      setError(null)
    } catch (err) {
      if ((err as Error).name !== 'AbortError') setError('Network error while loading.')
    }
  }, [id, ksReport, ksLanding])

  useEffect(() => { if (authStatus === 'unauthenticated') router.push('/login') }, [authStatus, router])
  useEffect(() => {
    if (authStatus !== 'authenticated') return
    const ac = new AbortController()
    reload(ac.signal)
    // While the campaign is live, poll for new events every 5s (Zone A telemetry)
    const iv = setInterval(() => { reload() }, 5000)
    return () => { ac.abort(); clearInterval(iv) }
  }, [authStatus, reload])

  async function api(path: string, body: unknown, okMsg: string) {
    if (busy) return
    setBusy(true); setError(null); setNote(null)
    try {
      const res = await fetch(`/api/campaigns/${id}${path}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) setError((json as { error?: string }).error ?? `Request failed (${res.status}).`)
      else setNote(okMsg)
      await reload()
    } catch {
      setError('Network error.')
    } finally { setBusy(false) }
  }

  function parseBulk(): { targets?: unknown[]; error?: string } {
    const lines = bulkText.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
    if (lines.length === 0) return { error: 'Paste at least one target (target_id per line, or CSV: target_id,role,department,channel).' }
    const rows: unknown[] = []
    for (const line of lines) {
      const parts = line.split(',').map(p => p.trim())
      const [target_id, role, department, ch, contact] = parts
      if (!target_id) return { error: 'Each row needs a pseudonymous target_id.' }
      let channel = ch === 'email' || ch === 'sms' ? ch : null
      let email = contact || null; if (channel === null && ch) { email = ch; channel = ch.indexOf('@') >= 0 ? 'email' : 'sms' }
      rows.push({ target_id, role: role || null, department: department || null, channel, email })
    }
    return { targets: rows }
  }

  if (authStatus === 'loading') return <div className="flex items-center justify-center min-h-screen" style={{ background: '#0a0e1a', color: '#00d4ff', fontFamily: 'monospace' }}>Loading…</div>
  if (!session) return null

  const sc = campaign ? statusColor[campaign.status] ?? '#64748b' : '#64748b'
  const nextButtons = campaign ? NEXT[campaign.status] ?? [] : []
  const editable = campaign ? ['DRAFT', 'READY'].includes(campaign.status) : false
  const ks = (campaign?.kill_switch ?? {}) as Record<string, unknown>

  return (
    <>
      <Navbar />
      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="mb-6" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: '1.5rem' }}>🎣</span>
          <h1 className="text-2xl font-bold" style={{ color: '#e2e8f0', fontFamily: 'monospace', margin: 0 }}>{campaign?.name ?? 'Campaign'}</h1>
          {campaign && (
            <span style={{ background: `${sc}22`, border: `1px solid ${sc}`, color: sc, borderRadius: 4, padding: '2px 10px', fontSize: '0.7rem', fontFamily: 'monospace', fontWeight: 700 }}>{campaign.status}</span>
          )}
          {deliveryProvider && (
            <span title={`Reported by ${deliveryProvider.reported_by ?? 'runner'} at ${deliveryProvider.updated_at}`} style={{
              background: deliveryProvider.value === 'simulation' ? '#14b8a622' : '#7f1d1d33',
              border: `1px solid ${deliveryProvider.value === 'simulation' ? '#14b8a6' : '#ef4444'}`,
              color: deliveryProvider.value === 'simulation' ? '#5eead4' : '#fecaca',
              borderRadius: 4, padding: '2px 10px', fontSize: '0.68rem', fontFamily: 'monospace', fontWeight: 700,
            }}>
              Delivery: {deliveryProvider.value === 'simulation' ? 'SIMULATION' : `LIVE (${deliveryProvider.value})`}
            </span>
          )}
          <span style={{ marginLeft: deliveryProvider ? 8 : 'auto', color: '#475569', fontFamily: 'monospace', fontSize: '0.68rem' }}>{busy ? '⚙ working…' : '● live'}</span>
        </div>

        {error && <div role="alert" className="cyber-card p-4 mb-3" style={{ color: '#ff6b6b', fontFamily: 'monospace', fontSize: '0.78rem', borderColor: '#7f1d1d' }}>{error}</div>}
        {note && <div className="cyber-card p-3 mb-3" style={{ color: '#5eead4', fontFamily: 'monospace', fontSize: '0.72rem', borderColor: '#14b8a6' }}>✓ {note}</div>}

        {campaign && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="cyber-card p-5">
              <div style={cardHeader}>Engagement</div>
              <Row k="Client ID" v={campaign.client_id} />
              <Row k="Engagement ID" v={campaign.engagement_id} />
              <Row k="Authorization ref" v={campaign.authorization_ref} />
              <Row k="Profile" v={campaign.profile} />
              <Row k="Created" v={new Date(campaign.created_at).toLocaleString()} />
              {campaign.start_time && <Row k="Started" v={new Date(campaign.start_time).toLocaleString()} />}
              {campaign.end_time && <Row k="Ended" v={new Date(campaign.end_time).toLocaleString()} />}
              {campaign.gophish_campaign_id != null && <Row k="GoPhish campaign" v={`#${campaign.gophish_campaign_id}`} />}
            </div>

            <div className="cyber-card p-5">
              <div style={cardHeader}>Rate control</div>
              <Row k="Batch size" v={campaign.batch_size} />
              <Row k="Interval" v={`${campaign.interval_seconds}s`} />
              <Row k="Max active" v={campaign.max_active} />
              <Row k="Business hours only" v={campaign.business_hours ? 'yes' : 'no'} />
              <Row k="Randomize timing" v={campaign.randomization ? 'yes' : 'no'} />
            </div>

            <div className="cyber-card p-5" style={{ gridColumn: '1 / -1' }}>
              <div style={cardHeader}>State machine</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {nextButtons.length === 0 && <div style={{ color: '#64748b', fontFamily: 'monospace', fontSize: '0.75rem' }}>Terminal state — no further transitions.</div>}
                {nextButtons.map(b => (
                  <button key={b.to} onClick={() => {
                  if (b.to === 'RUNNING') {
                    const activeChannels = Array.from(new Set(scenarios.map(s => s.channel))).join(', ') || 'none configured'
                    const ok = window.confirm(
                      `Start live delivery for this campaign?\n\n` +
                      `Active channel(s): ${activeChannels}\n` +
                      `Targets: ${targets.length}\n\n` +
                      (deliveryProvider
                        ? `Delivery provider is currently: ${deliveryProvider.value.toUpperCase()}` +
                          (deliveryProvider.value !== 'simulation' ? ' — THIS WILL SEND A REAL MESSAGE.\n\n' : '.\n\n')
                        : `Delivery provider status is unknown (could not reach status check) — ` +
                          `confirm with your team lead before proceeding.\n\n`) +
                      `Proceed?`
                    )
                    if (!ok) return
                  }
                  api('/transition', { to: b.to }, `Transitioned to ${b.to}`)
                }} disabled={busy}
                    style={{ background: b.danger ? '#7f1d1d33' : '#14b8a622', border: `1px solid ${b.danger ? '#ef4444' : '#14b8a6'}`, color: b.danger ? '#fecaca' : '#5eead4', borderRadius: 6, padding: '6px 14px', fontSize: '0.78rem', cursor: busy ? 'not-allowed' : 'pointer', fontFamily: 'monospace', opacity: busy ? 0.6 : 1 }}>
                    {b.label} → {b.to}
                  </button>
                ))}
              </div>
              <div style={{ color: '#475569', fontFamily: 'monospace', fontSize: '0.68rem', marginTop: 8 }}>
                Illegal transitions are refused server-side (409). Provider-side triggers only — Zone B triggers are inert in R1.
              </div>
            </div>

            <div className="cyber-card p-5">
              <div style={cardHeader}>Targets · {targets.length}</div>
              {targets.length > 0 && (
                <div style={{ maxHeight: 180, overflowY: 'auto', marginBottom: 10, border: '1px solid #101a2e', borderRadius: 4, padding: 6 }}>
                  {targets.slice(0, 20).map(t => (
                    <div key={t.id} style={{ fontFamily: 'monospace', fontSize: '0.68rem', color: '#94a3b8', padding: '2px 0' }}>
                      <span style={{ color: '#5eead4' }}>{t.target_id}</span>{t.role ? ` · ${t.role}` : ''}{t.department ? ` · ${t.department}` : ''}{t.channel ? ` · ${t.channel}` : ''}
                    {t.email && <span style={{ color: '#94a3b8' }}> · {t.email}</span>}
                    {t.channel === 'email' && !t.email && (
                      <span style={{ marginLeft: 6, background: '#7f1d1d33', border: '1px solid #ef4444', color: '#fecaca', borderRadius: 4, padding: '1px 6px', fontSize: '0.62rem', fontFamily: 'monospace', fontWeight: 700 }}>
                        ⚠ missing email
                      </span>
                    )}
                    </div>
                  ))}
                  {targets.length > 20 && <div style={{ color: '#475569', fontFamily: 'monospace', fontSize: '0.68rem', paddingTop: 4 }}>+ {targets.length - 20} more…</div>}
                </div>
              )}
              {editable ? (
                <>
                  <label style={labelSm}>Segment (optional)</label>
                  <input value={segment} onChange={e => setSegment(e.target.value)} placeholder="e.g. finance-pilot" className="cyber-input" style={{ width: '100%', fontFamily: 'monospace', fontSize: '0.75rem', marginBottom: 8 }} />
                  <label style={labelSm}>Targets — one per line (target_id[,role,department,email|sms])</label>
                  <textarea value={bulkText} onChange={e => setBulkText(e.target.value)} placeholder={"T-00001,Finance Analyst,Finance,email\nT-00002,AP Clerk,Finance,email"} rows={5} className="cyber-input" style={{ width: '100%', fontFamily: 'monospace', fontSize: '0.72rem', resize: 'vertical' }} />
                  <button onClick={() => {
                    const p = parseBulk()
                    if (p.error) { setError(p.error); return }
                    api('/targets', { segment: segment || null, targets: p.targets }, `Added ${(p.targets as unknown[]).length} targets`)
                    setBulkText('')
                  }} disabled={busy} className="cyber-btn" style={{ marginTop: 8, width: '100%', padding: 8, fontSize: '0.78rem' }}>Add Targets</button>
                </>
              ) : (
                <div style={{ color: '#475569', fontFamily: 'monospace', fontSize: '0.68rem' }}>Targets are locked once the campaign leaves READY.</div>
              )}
            </div>

            <div className="cyber-card p-5">
              <div style={cardHeader}>Scenarios · {scenarios.length}</div>
              {scenarios.length > 0 && (
                <div style={{ marginBottom: 10 }}>
                  {scenarios.map(s => (
                    <div key={s.id} style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: '#cbd5e1', padding: '3px 0', borderBottom: '1px solid #101a2e' }}>
                      <span style={{ color: '#5eead4' }}>{s.type}</span> · {s.channel} · {s.difficulty}{s.variant ? ` · variant ${s.variant}` : ''}
                    </div>
                  ))}
                </div>
              )}
              {editable ? (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div>
                      <label style={labelSm}>Type</label>
                      <select value={scType} onChange={e => setScType(e.target.value)} className="cyber-input" style={{ width: '100%', fontFamily: 'monospace', fontSize: '0.75rem' }}><option value="m365-alert">M365 Alert</option><option value="password-expiry">Password Expiry</option><option value="shared-document">Shared Document</option><option value="activity-detected">Activity Detected</option><option value="it-support">IT Support</option><option value="account-locked">Account Locked</option></select>
                    </div>
                    <div>
                      <label style={labelSm}>Channel</label>
                      <select value={scChannel} onChange={e => setScChannel(e.target.value as 'email' | 'sms')} className="cyber-input" style={{ width: '100%', fontFamily: 'monospace', fontSize: '0.75rem' }}>
                        <option value="email">email</option><option value="sms">sms</option>
                      </select>
                    </div>
                    <div>
                      <label style={labelSm}>Difficulty (NIST Phish Scale)</label>
                      <select value={scDifficulty} onChange={e => setScDifficulty(e.target.value as 'least' | 'moderate' | 'most')} className="cyber-input" style={{ width: '100%', fontFamily: 'monospace', fontSize: '0.75rem' }}>
                        <option value="least">least</option><option value="moderate">moderate</option><option value="most">most</option>
                      </select>
                    </div>
                    <div>
                      <label style={labelSm}>Variant (A/B)</label>
                      <input value={scVariant} onChange={e => setScVariant(e.target.value)} className="cyber-input" style={{ width: '100%', fontFamily: 'monospace', fontSize: '0.75rem' }} />
                    </div>
                  </div>
                  <button onClick={() => api('/scenarios', { type: scType, channel: scChannel, difficulty: scDifficulty, variant: scVariant || null }, 'Scenario added')} disabled={busy} className="cyber-btn" style={{ marginTop: 8, width: '100%', padding: 8, fontSize: '0.78rem' }}>Add Scenario</button>
                  <div style={{ color: '#475569', fontFamily: 'monospace', fontSize: '0.66rem', marginTop: 6 }}>Vishing / impersonation types are blocked in R1 (separate sign-off).</div>
                </>
              ) : (
                <div style={{ color: '#475569', fontFamily: 'monospace', fontSize: '0.68rem' }}>Scenarios are locked once the campaign leaves READY.</div>
              )}
            </div>

            <div className="cyber-card p-5" style={{ gridColumn: '1 / -1' }}>
              <div style={cardHeader}>Kill switch (provider-side)</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, alignItems: 'end' }}>
                <div>
                  <label style={labelSm}>Report threshold (recipients who reported it)</label>
                  <input type="number" min={0} value={ksReport} onChange={e => setKsReport(e.target.value)} placeholder="e.g. 5" className="cyber-input" style={{ width: '100%', fontFamily: 'monospace', fontSize: '0.78rem' }} />
                </div>
                <div>
                  <label style={labelSm}>Landing volume / minute</label>
                  <input type="number" min={0} value={ksLanding} onChange={e => setKsLanding(e.target.value)} placeholder="e.g. 50" className="cyber-input" style={{ width: '100%', fontFamily: 'monospace', fontSize: '0.78rem' }} />
                </div>
                <button onClick={() => {
                  const body: Record<string, unknown> = {}
                  const r = Number(ksReport); const l = Number(ksLanding)
                  if (Number.isFinite(r) && ksReport !== '') body.report_threshold = r
                  if (Number.isFinite(l) && ksLanding !== '') body.landing_volume_per_minute = l
                  api('/kill-switch', body, 'Kill-switch config saved')
                }} disabled={busy} className="cyber-btn" style={{ padding: '8px 14px', fontSize: '0.78rem' }}>Save</button>
              </div>
              <div style={{ display: 'flex', gap: 12, marginTop: 10, fontFamily: 'monospace', fontSize: '0.7rem' }}>
                <span style={{ color: '#5eead4' }}>✓ Zone A triggers active</span>
                <span style={{ color: '#475569' }}>○ Zone B triggers inert ({ks.zone_b_available === false ? 'zone_b_available: false' : 'not configured'})</span>
              </div>
            </div>

            <div className="cyber-card p-5" style={{ gridColumn: '1 / -1' }}>
              <div style={cardHeader}>Telemetry — Zone A (live · last 100)</div>
              {events.length === 0 && <div style={{ color: '#475569', fontFamily: 'monospace', fontSize: '0.72rem' }}>No events yet. The runner writes arrival · interaction · simulated-submission · session · report as it works.</div>}
              {events.length > 0 && (
                <div style={{ maxHeight: 240, overflowY: 'auto' }}>
                  {events.map(e => (
                    <div key={e.id} style={{ fontFamily: 'monospace', fontSize: '0.7rem', color: '#94a3b8', padding: '3px 0', borderBottom: '1px solid #101a2e', display: 'flex', gap: 10 }}>
                      <span style={{ color: '#64748b', minWidth: 160 }}>{new Date(e.occurred_at).toLocaleString()}</span>
                      <span style={{ color: '#5eead4', minWidth: 170 }}>{e.event_type}</span>
                      <span style={{ minWidth: 120 }}>{e.target_id}</span>
                      <span style={{ color: '#475569' }}>zone {e.zone}{e.source ? ` · ${e.source}` : ''}</span>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ color: '#475569', fontFamily: 'monospace', fontSize: '0.66rem', marginTop: 8 }}>Attempt-only — never records passwords, secrets, credentials or form payloads.</div>
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
