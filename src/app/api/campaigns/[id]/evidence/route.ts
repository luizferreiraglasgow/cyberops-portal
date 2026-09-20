import { NextRequest, NextResponse } from 'next/server'
import { buildEvidencePack } from '@/lib/campaigns'
const dynamic = 'force-dynamic'
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = req.headers.get('authorization')
  if (!auth || (!auth.includes(process.env.CAMPAIGN_RUNNER_TOKEN || '') && !req.cookies.get('authjs.session-token'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const result = await buildEvidencePack(params.id)
  if ('error' in result) return NextResponse.json(result, { status: 400 })
  return NextResponse.json(result)
}
