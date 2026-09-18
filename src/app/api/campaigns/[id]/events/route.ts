import { NextRequest, NextResponse } from 'next/server'
import { authorizeCampaignCall } from '@/lib/campaignAuth'
import { getCampaign, addEvents, listEvents } from '@/lib/campaigns'
import { supabaseErrorResponse } from '@/lib/supabase'

export const maxDuration = 30
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authorizeCampaignCall(req)
  if (auth instanceof NextResponse) return auth
  if (!UUID.test(params.id)) return NextResponse.json({ error: 'Invalid campaign id' }, { status: 400 })
  const url = new URL(req.url)
  const limit = Number(url.searchParams.get('limit') ?? '200')
  const r = await listEvents(params.id, Number.isFinite(limit) ? limit : 200)
  if (!r.ok) return supabaseErrorResponse(r)
  return NextResponse.json({ events: r.data })
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authorizeCampaignCall(req)
  if (auth instanceof NextResponse) return auth
  if (!UUID.test(params.id)) return NextResponse.json({ error: 'Invalid campaign id' }, { status: 400 })
  let body: Record<string, unknown>
  try { body = (await req.json()) ?? {} } catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }) }
  const cur = await getCampaign(params.id)
  if (!cur.ok) return supabaseErrorResponse(cur)
  if (!cur.data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  // Events are attempt-only telemetry — validated in the data layer against payload leaks.
  const r = await addEvents(cur.data, body.events ?? body)
  if (!r.ok) return supabaseErrorResponse(r)
  return NextResponse.json(r.data, { status: 201 })
}
