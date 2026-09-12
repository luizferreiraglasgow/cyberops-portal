import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const ip = req.nextUrl.searchParams.get('ip')
  if (!ip) return NextResponse.json({ error: 'ip param required' }, { status: 400 })
  const res = await fetch(`https://api.abuseipdb.com/api/v2/check?ipAddress=${encodeURIComponent(ip)}&maxAgeInDays=90&verbose`, { headers: { Key: process.env.ABUSEIPDB_API_KEY!, Accept: 'application/json' } })
  const data = await res.json()
  return NextResponse.json(data)
}
