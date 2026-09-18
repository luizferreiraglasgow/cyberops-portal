import { NextRequest, NextResponse } from 'next/server'
import { authorizeCampaignCall } from '@/lib/campaignAuth'
import { getCampaign, setKillSwitch } from '@/lib/campaigns'
import { supabaseErrorResponse } from '@/lib/supabase'

export const maxDuration = 30
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Update the kill-switch config on the campaign row (jsonb).
 *  Only provider-side (Zone A) triggers are accepted in R1 — client-signal
 *  triggers (Zone B) are inert until an authorized feed is wired (spec §5). */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authorizeCampaignCall(req)
  if (auth instanceof NextResponse) return auth
  if (!UUID.test(params.id)) return NextResponse.json({ error: 'Invalid campaign id' }, { status: 400 })
  let body: Record<string, unknown>
  try { body = (await req.json()) ?? {} } catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }) }
  const cur = await getCampaign(params.id)
  if (!cur.ok) return supabaseErrorResponse(cur)
  if (!cur.data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const cfg: Record<string, unknown> = {}
  // Provider-side (Zone A) — always available
  if (typeof body.report_threshold === 'number' && body.report_threshold >= 0) {
    cfg.report_threshold = Math.floor(body.report_threshold)
  }
  if (typeof body.landing_volume_per_minute === 'number' && body.landing_volume_per_minute >= 0) {
    cfg.landing_volume_per_minute = Math.floor(body.landing_volume_per_minute)
  }
  // Zone B triggers stay inert in R1; the UI must show them as inactive.
  cfg.zone_b_available = false
  const r = await setKillSwitch(params.id, cfg)
  if (!r.ok) return supabaseErrorResponse(r)
  return NextResponse.json({ campaign: r.data, kill_switch: cfg })
}
