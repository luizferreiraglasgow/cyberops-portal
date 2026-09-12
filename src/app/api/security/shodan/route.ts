import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const ip = req.nextUrl.searchParams.get('ip')
  if (!ip) return NextResponse.json({ error: 'ip param required' }, { status: 400 })
  const res = await fetch(`https://api.shodan.io/shodan/host/${encodeURIComponent(ip)}?key=${process.env.SHODAN_API_KEY}`)
  const data = await res.json()
  return NextResponse.json(data)
}
