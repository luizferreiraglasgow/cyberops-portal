import { NextRequest, NextResponse } from 'next/server'
import { authorizeCampaignCall } from '@/lib/campaignAuth'
import { getCampaign, transitionCampaign, isValidTransition } from '@/lib/campaigns'
import type { CampaignStatus } from '@/lib/campaigns'
import { supabaseErrorResponse } from '@/lib/supabase'

export const maxDuration = 30
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const STATUSES: CampaignStatus[] = [
  'DRAFT','READY','SCHEDULED','RUNNING','COMPLETED','REPORTING',
  'PAUSED','STOPPED','ABORTED','INCIDENT',
]

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authorizeCampaignCall(req)
  if (auth instanceof NextResponse) return auth
  if (!UUID.test(params.id)) return NextResponse.json({ error: 'Invalid campaign id' }, { status: 400 })
  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }) }
  const to = (body as { to?: unknown } | null)?.to
  if (!STATUSES.includes(to as CampaignStatus)) {
    return NextResponse.json({ error: `to must be one of ${STATUSES.join(', ')}` }, { status: 400 })
  }
  const cur = await getCampaign(params.id)
  if (!cur.ok) return supabaseErrorResponse(cur)
  if (!cur.data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!isValidTransition(cur.data.status, to as CampaignStatus)) {
    return NextResponse.json({
      error: `Illegal transition ${cur.data.status} → ${to}`,
      from: cur.data.status,
    }, { status: 409 })
  }
  const r = await transitionCampaign(params.id, cur.data.status, to as CampaignStatus)
  if (!r.ok) return supabaseErrorResponse(r)
  if (!r.data) {
    // Row status changed between our read and our conditional PATCH.
    return NextResponse.json({ error: 'Concurrent state change; retry' }, { status: 409 })
  }
  return NextResponse.json({ campaign: r.data })
}
