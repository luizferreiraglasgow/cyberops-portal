// R2.4-hardening item 2.2: simulate normaliseTargets() with NO persistence,
// so staff can validate a bulk-target paste before it touches the DB.
// Same auth + input contract as POST .../targets, minus the DB writes.
import { NextRequest, NextResponse } from 'next/server'
import { authorizeCampaignCall } from '@/lib/campaignAuth'
import { getCampaign, normaliseTargets } from '@/lib/campaigns'
import { supabaseErrorResponse } from '@/lib/supabase'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authorizeCampaignCall(req)
  if (auth instanceof NextResponse) return auth
  if (!UUID.test(params.id)) return NextResponse.json({ error: 'Invalid campaign id' }, { status: 400 })
  let body: Record<string, unknown>
  try { body = (await req.json()) ?? {} } catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }) }

  const cur = await getCampaign(params.id)
  if (!cur.ok) return supabaseErrorResponse(cur)
  if (!cur.data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const v = normaliseTargets(body.targets)
  if ('error' in v) return NextResponse.json({ error: v.error }, { status: 400 })
  return NextResponse.json({ preview: { count: v.value.length, targets: v.value } })
}
