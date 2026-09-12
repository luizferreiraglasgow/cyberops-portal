import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const hash = req.nextUrl.searchParams.get('hash')
  const url = req.nextUrl.searchParams.get('url')
  const ip = req.nextUrl.searchParams.get('ip')
  let vtUrl: string
  if (hash) vtUrl = `https://www.virustotal.com/api/v3/files/${hash}`
  else if (ip) vtUrl = `https://www.virustotal.com/api/v3/ip_addresses/${ip}`
  else if (url) { const encoded = Buffer.from(url).toString('base64url'); vtUrl = `https://www.virustotal.com/api/v3/urls/${encoded}` }
  else return NextResponse.json({ error: 'hash, ip or url param required' }, { status: 400 })
  const res = await fetch(vtUrl, { headers: { 'x-apikey': process.env.VIRUSTOTAL_API_KEY! } })
  const data = await res.json()
  return NextResponse.json(data)
}
