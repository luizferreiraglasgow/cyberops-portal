import { NextRequest, NextResponse } from 'next/server'
import { authorizeCampaignCall } from '@/lib/campaignAuth'
import { getCampaign, updateCampaign, listScenarios } from '@/lib/campaigns'
import { supabaseErrorResponse } from '@/lib/supabase'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Read one campaign (Authentik session OR runner Bearer token).
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authorizeCampaignCall(req)
  if (auth instanceof NextResponse) return auth
  if (!UUID.test(params.id)) return NextResponse.json({ error: 'Invalid campaign id' }, { status: 400 })
  const r = await getCampaign(params.id)
  if (!r.ok) return supabaseErrorResponse(r)
  if (!r.data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  // R2.4 - additive: expose the latest scenario type so the runner can pick the right
  // GoPhish template/page per scenario. Non-fatal if this lookup fails.
  let scenario_type: string | null = null
  try {
    const sc = await listScenarios(params.id)
    if (sc.ok && sc.data && sc.data.length > 0) scenario_type = sc.data[sc.data.length - 1].type
  } catch {}
  return NextResponse.json({ campaign: { ...r.data, scenario_type } })
}

// R2.2 - narrow PATCH: only gophish_campaign_id is accepted for now.
// Runner uses this after creating the GoPhish campaign; UI has no PATCH surface.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authorizeCampaignCall(req)
  if (auth instanceof NextResponse) return auth
  if (!UUID.test(params.id)) return NextResponse.json({ error: 'Invalid campaign id' }, { status: 400 })
  let body: Record<string, unknown>
  try { body = (await req.json()) ?? {} } catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }) }
  const updates: Record<string, unknown> = {}
  if (body.gophish_campaign_id !== undefined && body.gophish_campaign_id !== null) {
    const n = Number(body.gophish_campaign_id)
    if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) {
      return NextResponse.json({ error: 'gophish_campaign_id must be a positive integer' }, { status: 400 })
    }
    updates.gophish_campaign_id = n
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No updatable fields provided (whitelist: gophish_campaign_id)' }, { status: 400 })
  }
  const r = await updateCampaign(params.id, updates)
  if (!r.ok) return supabaseErrorResponse(r)
  if (!r.data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ campaign: r.data })
}
