// Campaign data layer (server-only — imported by route handlers). Zone A, provider-owned.
// Pseudonymised data only; tenant scoping (client_id / engagement_id / authorization_ref)
// is carried on every row for multi-tenant isolation and per-engagement teardown.
import { supabaseRest, type SupabaseResult } from '@/lib/supabase'

export type CampaignProfile = 'awareness' | 'blackbox' | 'adversary'
export type CampaignStatus =
  | 'DRAFT' | 'READY' | 'SCHEDULED' | 'RUNNING' | 'COMPLETED' | 'REPORTING'
  | 'PAUSED' | 'STOPPED' | 'ABORTED' | 'INCIDENT'

export interface Campaign {
  id: string
  client_id: string
  engagement_id: string
  authorization_ref: string
  name: string
  profile: CampaignProfile
  status: CampaignStatus
  batch_size: number
  interval_seconds: number
  max_active: number
  business_hours: boolean
  randomization: boolean
  kill_switch: Record<string, unknown>
  start_time: string | null
  end_time: string | null
  created_at: string
  updated_at: string
}

export interface NewCampaignInput {
  name: string
  client_id: string
  engagement_id: string
  authorization_ref: string
  profile: CampaignProfile
  batch_size: number
  interval_seconds: number
  max_active: number
  business_hours: boolean
  randomization: boolean
}

const PROFILES: CampaignProfile[] = ['awareness', 'blackbox', 'adversary']

/** Validate + normalise builder input. Returns an error string or a clean row. */
export function validateNewCampaign(
  input: Record<string, unknown>,
): { error: string } | { value: NewCampaignInput } {
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
  const name = str(input.name)
  const client_id = str(input.client_id)
  const engagement_id = str(input.engagement_id)
  const authorization_ref = str(input.authorization_ref)
  if (!name) return { error: 'name is required' }
  if (!client_id) return { error: 'client_id is required' }
  if (!engagement_id) return { error: 'engagement_id is required' }
  if (!authorization_ref) return { error: 'authorization_ref is required (SoW / T&C reference)' }
  const profile = PROFILES.includes(input.profile as CampaignProfile)
    ? (input.profile as CampaignProfile)
    : 'awareness'
  const clampInt = (v: unknown, def: number, min: number) => {
    const n = Number.isFinite(Number(v)) ? Math.floor(Number(v)) : def
    return n < min ? min : n
  }
  return {
    value: {
      name, client_id, engagement_id, authorization_ref, profile,
      batch_size: clampInt(input.batch_size, 25, 1),
      interval_seconds: clampInt(input.interval_seconds, 300, 0),
      max_active: clampInt(input.max_active, 50, 1),
      business_hours: input.business_hours !== false,
      randomization: input.randomization !== false,
    },
  }
}

/** Insert a new campaign in DRAFT. */
export async function createCampaign(input: NewCampaignInput): Promise<SupabaseResult<Campaign>> {
  const r = await supabaseRest<Campaign[]>('/campaign', {
    method: 'POST',
    prefer: 'return=representation',
    body: JSON.stringify({ ...input, status: 'DRAFT' }),
  })
  if (!r.ok) return r
  const row = Array.isArray(r.data) ? r.data[0] : undefined
  if (!row) return { ok: false, status: 500, error: 'Campaign was not returned after insert' }
  return { ok: true, data: row }
}

/** Read one campaign by id (null if not found). */
export async function getCampaign(id: string): Promise<SupabaseResult<Campaign | null>> {
  const r = await supabaseRest<Campaign[]>(`/campaign?id=eq.${encodeURIComponent(id)}&select=*`)
  if (!r.ok) return r
  return { ok: true, data: (Array.isArray(r.data) ? r.data[0] : null) ?? null }
}

/** List campaigns, newest first. */
export async function listCampaigns(): Promise<SupabaseResult<Campaign[]>> {
  const r = await supabaseRest<Campaign[]>('/campaign?select=*&order=created_at.desc')
  if (!r.ok) return r
  return { ok: true, data: Array.isArray(r.data) ? r.data : [] }
}


// ── S4a — state machine, targets, scenarios, events, kill-switch ───────────

export type EventType =
  | 'arrival' | 'interaction' | 'simulated_submission' | 'session' | 'report'

export interface TargetRow {
  id: string; campaign_id: string; group_id: string; target_id: string
  role: string | null; department: string | null; channel: 'email' | 'sms' | null
}

export interface ScenarioRow {
  id: string; campaign_id: string; type: string; channel: 'email' | 'sms'
  difficulty: 'least' | 'moderate' | 'most'; variant: string | null
}

export interface EventRow {
  id: string; campaign_id: string; target_id: string; message_id: string | null
  event_type: EventType; zone: 'A' | 'B'; source: string | null
  session_ref: string | null; occurred_at: string
}

/** Allowed transitions (spec §5). Attempting anything else → 400. */
const TRANSITIONS: Record<CampaignStatus, CampaignStatus[]> = {
  DRAFT:     ['READY', 'ABORTED'],
  READY:     ['SCHEDULED', 'DRAFT', 'ABORTED'],
  SCHEDULED: ['RUNNING', 'READY', 'ABORTED'],
  RUNNING:   ['PAUSED', 'COMPLETED', 'STOPPED', 'ABORTED', 'INCIDENT'],
  PAUSED:    ['RUNNING', 'STOPPED', 'ABORTED'],
  STOPPED:   ['REPORTING', 'ABORTED'],
  ABORTED:   ['REPORTING'],
  INCIDENT:  ['PAUSED', 'STOPPED', 'ABORTED'],
  COMPLETED: ['REPORTING'],
  REPORTING: [],
}

export function isValidTransition(from: CampaignStatus, to: CampaignStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false
}

/** Atomic transition: only succeeds if the current status is still `from`. */
export async function transitionCampaign(
  id: string, from: CampaignStatus, to: CampaignStatus,
): Promise<SupabaseResult<Campaign | null>> {
  const now = new Date().toISOString()
  const patch: Record<string, unknown> = { status: to, updated_at: now }
  if (to === 'RUNNING' && from !== 'PAUSED') patch.start_time = now
  if (to === 'COMPLETED' || to === 'STOPPED' || to === 'ABORTED') patch.end_time = now
  const r = await supabaseRest<Campaign[]>(
    `/campaign?id=eq.${encodeURIComponent(id)}&status=eq.${from}`,
    { method: 'PATCH', prefer: 'return=representation', body: JSON.stringify(patch) },
  )
  if (!r.ok) return r
  const row = Array.isArray(r.data) ? r.data[0] : undefined
  return { ok: true, data: row ?? null }
}

/** Upsert a kill-switch config on the campaign row (jsonb). */
export async function setKillSwitch(
  id: string, killSwitch: Record<string, unknown>,
): Promise<SupabaseResult<Campaign | null>> {
  const r = await supabaseRest<Campaign[]>(
    `/campaign?id=eq.${encodeURIComponent(id)}`,
    {
      method: 'PATCH', prefer: 'return=representation',
      body: JSON.stringify({ kill_switch: killSwitch, updated_at: new Date().toISOString() }),
    },
  )
  if (!r.ok) return r
  return { ok: true, data: (Array.isArray(r.data) ? r.data[0] : null) ?? null }
}

// ── Targets ────────────────────────────────────────────────────────────
export interface NewTargetInput {
  target_id: string; role?: string | null; department?: string | null
  channel?: 'email' | 'sms' | null
}

function normaliseTargets(raw: unknown): { error: string } | { value: NewTargetInput[] } {
  if (!Array.isArray(raw)) return { error: 'targets must be an array' }
  if (raw.length === 0 || raw.length > 500) return { error: 'targets: 1..500 entries' }
  const seen = new Set<string>()
  const out: NewTargetInput[] = []
  for (const t of raw) {
    if (!t || typeof t !== 'object') return { error: 'target must be an object' }
    const o = t as Record<string, unknown>
    const target_id = typeof o.target_id === 'string' ? o.target_id.trim() : ''
    if (!target_id) return { error: 'each target needs a pseudonymous target_id' }
    if (seen.has(target_id)) return { error: `duplicate target_id: ${target_id}` }
    seen.add(target_id)
    const channel = o.channel === 'email' || o.channel === 'sms' ? o.channel : null
    out.push({
      target_id,
      role: typeof o.role === 'string' ? o.role : null,
      department: typeof o.department === 'string' ? o.department : null,
      channel,
    })
  }
  return { value: out }
}

/** Bulk-add targets. Creates a target_group holding the batch. */
export async function addTargets(
  c: Campaign, segment: string | null, targets: unknown,
): Promise<SupabaseResult<{ group_id: string; count: number }>> {
  const v = normaliseTargets(targets)
  if ('error' in v) return { ok: false, status: 400, error: v.error }
  const g = await supabaseRest<{ id: string }[]>('/target_group', {
    method: 'POST', prefer: 'return=representation',
    body: JSON.stringify({
      campaign_id: c.id, client_id: c.client_id, engagement_id: c.engagement_id,
      authorization_ref: c.authorization_ref, segment, count: v.value.length,
    }),
  })
  if (!g.ok) return g
  const group = Array.isArray(g.data) ? g.data[0] : undefined
  if (!group) return { ok: false, status: 500, error: 'target_group not returned' }
  const rows = v.value.map(t => ({
    campaign_id: c.id, group_id: group.id, client_id: c.client_id,
    engagement_id: c.engagement_id, authorization_ref: c.authorization_ref, ...t,
  }))
  const t = await supabaseRest<unknown[]>('/target', {
    method: 'POST', prefer: 'return=minimal', body: JSON.stringify(rows),
  })
  if (!t.ok) return t
  return { ok: true, data: { group_id: group.id, count: v.value.length } }
}

export async function listTargets(campaignId: string): Promise<SupabaseResult<TargetRow[]>> {
  const r = await supabaseRest<TargetRow[]>(
    `/target?campaign_id=eq.${encodeURIComponent(campaignId)}&select=id,campaign_id,group_id,target_id,role,department,channel&order=created_at.asc`,
  )
  if (!r.ok) return r
  return { ok: true, data: Array.isArray(r.data) ? r.data : [] }
}

// ── Scenarios ──────────────────────────────────────────────────────────
export interface NewScenarioInput {
  type: string; channel: 'email' | 'sms'
  difficulty?: 'least' | 'moderate' | 'most'; variant?: string | null
}

export async function addScenario(
  c: Campaign, input: Record<string, unknown>,
): Promise<SupabaseResult<ScenarioRow>> {
  const type = typeof input.type === 'string' ? input.type.trim() : ''
  const channel = input.channel === 'email' || input.channel === 'sms' ? input.channel : null
  const difficulty =
    input.difficulty === 'least' || input.difficulty === 'most' ? input.difficulty : 'moderate'
  const variant = typeof input.variant === 'string' ? input.variant : null
  if (!type) return { ok: false, status: 400, error: 'scenario type is required' }
  if (!channel) return { ok: false, status: 400, error: 'channel must be email|sms' }
  const r = await supabaseRest<ScenarioRow[]>('/scenario', {
    method: 'POST', prefer: 'return=representation',
    body: JSON.stringify({
      campaign_id: c.id, client_id: c.client_id, engagement_id: c.engagement_id,
      authorization_ref: c.authorization_ref, type, channel, difficulty, variant,
    }),
  })
  if (!r.ok) return r
  const row = Array.isArray(r.data) ? r.data[0] : undefined
  if (!row) return { ok: false, status: 500, error: 'scenario not returned' }
  return { ok: true, data: row }
}

export async function listScenarios(campaignId: string): Promise<SupabaseResult<ScenarioRow[]>> {
  const r = await supabaseRest<ScenarioRow[]>(
    `/scenario?campaign_id=eq.${encodeURIComponent(campaignId)}&select=id,campaign_id,type,channel,difficulty,variant&order=created_at.asc`,
  )
  if (!r.ok) return r
  return { ok: true, data: Array.isArray(r.data) ? r.data : [] }
}

// ── Events (attempt-only telemetry) ────────────────────────────────────
const EVENT_TYPES: EventType[] = [
  'arrival', 'interaction', 'simulated_submission', 'session', 'report',
]

export interface NewEventInput {
  target_id: string; event_type: EventType; message_id?: string | null
  session_ref?: string | null; source?: string | null
  zone?: 'A' | 'B'; occurred_at?: string | null
}

function normaliseEvents(raw: unknown): { error: string } | { value: NewEventInput[] } {
  const arr = Array.isArray(raw) ? raw : raw ? [raw] : []
  if (arr.length === 0 || arr.length > 500) return { error: 'events: 1..500 entries' }
  const out: NewEventInput[] = []
  for (const e of arr) {
    if (!e || typeof e !== 'object') return { error: 'event must be an object' }
    const o = e as Record<string, unknown>
    const target_id = typeof o.target_id === 'string' ? o.target_id.trim() : ''
    if (!target_id) return { error: 'event.target_id is required (pseudonymous)' }
    const event_type = EVENT_TYPES.includes(o.event_type as EventType)
      ? (o.event_type as EventType) : null
    if (!event_type) return { error: `event.event_type must be one of ${EVENT_TYPES.join(', ')}` }
    // reject any attempt to smuggle secrets — the schema has no such column
    for (const banned of ['password', 'secret', 'credential', 'form', 'payload']) {
      if (banned in o) return { error: `event must not carry '${banned}' — attempt-only telemetry` }
    }
    out.push({
      target_id, event_type,
      message_id: typeof o.message_id === 'string' ? o.message_id : null,
      session_ref: typeof o.session_ref === 'string' ? o.session_ref : null,
      source: typeof o.source === 'string' ? o.source : null,
      zone: o.zone === 'B' ? 'B' : 'A',
      occurred_at: typeof o.occurred_at === 'string' ? o.occurred_at : null,
    })
  }
  return { value: out }
}

/** Record attempt-only telemetry. NEVER carries payload/credentials. */
export async function addEvents(
  c: Campaign, raw: unknown,
): Promise<SupabaseResult<{ inserted: number }>> {
  const v = normaliseEvents(raw)
  if ('error' in v) return { ok: false, status: 400, error: v.error }
  const rows = v.value.map(e => ({
    campaign_id: c.id, client_id: c.client_id, engagement_id: c.engagement_id,
    authorization_ref: c.authorization_ref, target_id: e.target_id,
    message_id: e.message_id, event_type: e.event_type, source: e.source,
    session_ref: e.session_ref, zone: e.zone,
    ...(e.occurred_at ? { occurred_at: e.occurred_at } : {}),
  }))
  const r = await supabaseRest<unknown[]>('/event', {
    method: 'POST', prefer: 'return=minimal', body: JSON.stringify(rows),
  })
  if (!r.ok) return r
  return { ok: true, data: { inserted: v.value.length } }
}

export async function listEvents(
  campaignId: string, limit = 200,
): Promise<SupabaseResult<EventRow[]>> {
  const lim = Math.max(1, Math.min(500, Math.floor(limit)))
  const r = await supabaseRest<EventRow[]>(
    `/event?campaign_id=eq.${encodeURIComponent(campaignId)}&select=id,campaign_id,target_id,message_id,event_type,zone,source,session_ref,occurred_at&order=occurred_at.desc&limit=${lim}`,
  )
  if (!r.ok) return r
  return { ok: true, data: Array.isArray(r.data) ? r.data : [] }
}

// S5 — Evidence Pack Builder
export interface EvidencePack {
  campaign_id: string
  campaign_name: string
  client_id: string
  engagement_id: string
  authorization_ref: string
  scorecard: { targets_total: number; targets_reached: number; simulated_submissions: number; reports: number; kill_switch_triggered: boolean }
  timeline: Array<{ timestamp: string; event_type: string; target_id?: string; source: string }>
}

export async function buildEvidencePack(campaignId: string): Promise<EvidencePack | { error: string }> {
  const campaignRes = await fetch(`${process.env.SUPABASE_URL}/rest/v1/public.campaign?id=eq.${campaignId}`, {
    headers: { Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`, apikey: process.env.SUPABASE_SERVICE_ROLE_KEY || '' }
  })
  const campaigns = await campaignRes.json()
  if (!campaigns?.[0]) return { error: 'Campaign not found' }
  const campaign = campaigns[0]
  const eventsRes = await fetch(`${process.env.SUPABASE_URL}/rest/v1/public.event?campaign_id=eq.${campaignId}&order=timestamp.asc`, {
    headers: { Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`, apikey: process.env.SUPABASE_SERVICE_ROLE_KEY || '' }
  })
  const events = await eventsRes.json()
  const arrivals = events.filter((e: Record<string, unknown>) => e.event_type === 'arrival')
  const submissions = events.filter((e: Record<string, unknown>) => e.event_type === 'simulated_submission')
  const reports = events.filter((e: Record<string, unknown>) => e.event_type === 'report')
  const targetsReached = new Set(arrivals.map((e: Record<string, unknown>) => e.target_id))
  return {
    campaign_id: campaign.id, campaign_name: campaign.name, client_id: campaign.client_id, engagement_id: campaign.engagement_id, authorization_ref: campaign.authorization_ref,
    scorecard: { targets_total: campaign.targets?.length || 0, targets_reached: targetsReached.size, simulated_submissions: submissions.length, reports: reports.length, kill_switch_triggered: reports.length >= (campaign.kill_switch?.report_threshold || 999) },
    timeline: events.map((e: Record<string, unknown>) => ({ timestamp: e.timestamp as string, event_type: e.event_type as string, target_id: e.target_id as string | undefined, source: e.source as string }))
  }
}

// R2.2 - runner writes gophish_campaign_id back after creating GoPhish campaign.
// Whitelisted PATCH from the portal API, service_role bypasses RLS.
export async function updateCampaign(
  id: string,
  updates: Record<string, unknown>,
): Promise<SupabaseResult<Campaign | null>> {
  const r = await supabaseRest<Campaign[]>(
    `/campaign?id=eq.${encodeURIComponent(id)}`,
    { method: 'PATCH', prefer: 'return=representation', body: JSON.stringify(updates) },
  )
  if (!r.ok) return r
  return { ok: true, data: (Array.isArray(r.data) ? r.data[0] : null) ?? null }
}
