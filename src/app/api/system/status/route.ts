// R2.4-hardening item 1: surface node-02's DELIVERY_PROVIDER in the portal.
// The runner (node-02) has no public endpoint, so it reports its own status
// here on startup/tick; the portal UI reads it back. Read: any authorized
// caller (session or runner). Write: runner only (Bearer token), never the
// browser session, mirroring the narrow-whitelist pattern in
// PATCH /api/campaigns/[id] (gophish_campaign_id).
import { NextRequest, NextResponse } from 'next/server'
import { authorizeCampaignCall } from '@/lib/campaignAuth'
import { supabaseRest, supabaseErrorResponse } from '@/lib/supabase'

type StatusRow = { key: string; value: string; reported_by: string | null; updated_at: string }

export async function GET(req: NextRequest) {
  const auth = await authorizeCampaignCall(req)
  if (auth instanceof NextResponse) return auth
  const r = await supabaseRest<StatusRow[]>('/system_status?key=eq.delivery_provider&select=*&limit=1')
  if (!r.ok) return supabaseErrorResponse(r)
  return NextResponse.json({ status: r.data[0] ?? null })
}

export async function POST(req: NextRequest) {
  const auth = await authorizeCampaignCall(req)
  if (auth instanceof NextResponse) return auth
  if (auth.kind !== 'runner') {
    return NextResponse.json({ error: 'Only the runner may report system status' }, { status: 403 })
  }
  let body: Record<string, unknown>
  try { body = (await req.json()) ?? {} } catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }) }
  const value = body.value
  if (typeof value !== 'string' || value.length === 0 || value.length > 100) {
    return NextResponse.json({ error: 'value must be a non-empty string (max 100 chars)' }, { status: 400 })
  }
  const r = await supabaseRest<StatusRow[]>('/system_status', {
    method: 'POST',
    prefer: 'resolution=merge-duplicates,return=representation',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify([{ key: 'delivery_provider', value, reported_by: 'campaign-runner@node-02', updated_at: new Date().toISOString() }]),
  })
  if (!r.ok) return supabaseErrorResponse(r)
  return NextResponse.json({ status: r.data[0] })
}
