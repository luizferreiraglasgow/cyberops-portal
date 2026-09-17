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
