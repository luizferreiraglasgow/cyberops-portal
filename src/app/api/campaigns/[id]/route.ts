import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getCampaign } from '@/lib/campaigns'
import { supabaseErrorResponse } from '@/lib/supabase'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Read one campaign (Authentik session required).
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!UUID.test(params.id)) return NextResponse.json({ error: 'Invalid campaign id' }, { status: 400 })
  const r = await getCampaign(params.id)
  if (!r.ok) return supabaseErrorResponse(r)
  if (!r.data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ campaign: r.data })
}
