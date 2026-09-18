import { NextRequest, NextResponse } from 'next/server'
import { authorizeCampaignCall } from '@/lib/campaignAuth'
import { getCampaign, addTargets, listTargets } from '@/lib/campaigns'
import { supabaseErrorResponse } from '@/lib/supabase'

export const maxDuration = 30
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authorizeCampaignCall(req)
  if (auth instanceof NextResponse) return auth
  if (!UUID.test(params.id)) return NextResponse.json({ error: 'Invalid campaign id' }, { status: 400 })
  const r = await listTargets(params.id)
  if (!r.ok) return supabaseErrorResponse(r)
  return NextResponse.json({ targets: r.data })
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
  // Targets can only be edited while the campaign is still being built.
  const editable = ['DRAFT', 'READY']
  if (!editable.includes(cur.data.status)) {
    return NextResponse.json({ error: `targets are read-only in status ${cur.data.status}` }, { status: 409 })
  }
  const segment = typeof body.segment === 'string' ? body.segment : null
  const r = await addTargets(cur.data, segment, body.targets)
  if (!r.ok) return supabaseErrorResponse(r)
  return NextResponse.json(r.data, { status: 201 })
}
