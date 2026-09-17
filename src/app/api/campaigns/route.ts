import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createCampaign, listCampaigns, validateNewCampaign } from '@/lib/campaigns'
import { supabaseErrorResponse } from '@/lib/supabase'

export const maxDuration = 30

// List campaigns (Authentik session required).
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const r = await listCampaigns()
  if (!r.ok) return supabaseErrorResponse(r)
  return NextResponse.json({ campaigns: r.data })
}

// Create a DRAFT campaign (Authentik session required). Records authorization_ref (§11.3).
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }) }
  const v = validateNewCampaign((body ?? {}) as Record<string, unknown>)
  if ('error' in v) return NextResponse.json({ error: v.error }, { status: 400 })
  const r = await createCampaign(v.value)
  if (!r.ok) return supabaseErrorResponse(r)
  return NextResponse.json({ campaign: r.data }, { status: 201 })
}
