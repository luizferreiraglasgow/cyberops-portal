import { NextRequest, NextResponse } from 'next/server'
import { authorizeCampaignCall } from '@/lib/campaignAuth'
import { createCampaign, listCampaigns, validateNewCampaign } from '@/lib/campaigns'
import { supabaseErrorResponse } from '@/lib/supabase'

export const maxDuration = 30

// List campaigns (Authentik session OR runner Bearer token).
export async function GET(req: NextRequest) {
  const auth = await authorizeCampaignCall(req)
  if (auth instanceof NextResponse) return auth
  const r = await listCampaigns()
  if (!r.ok) return supabaseErrorResponse(r)
  return NextResponse.json({ campaigns: r.data })
}

// Create a DRAFT campaign (Authentik session OR runner Bearer). Records authorization_ref (§11.3).
export async function POST(req: NextRequest) {
  const auth = await authorizeCampaignCall(req)
  if (auth instanceof NextResponse) return auth
  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }) }
  const v = validateNewCampaign((body ?? {}) as Record<string, unknown>)
  if ('error' in v) return NextResponse.json({ error: v.error }, { status: 400 })

  const r = await createCampaign(v.value)
  if (!r.ok) return supabaseErrorResponse(r)
  return NextResponse.json({ campaign: r.data }, { status: 201 })
}
