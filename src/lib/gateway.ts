import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'

const GATEWAY_URL = process.env.GATEWAY_URL ?? 'https://mcp.cyberopsplatform.co.uk'

/** Server-side proxy to a paid MCP gateway endpoint (Gemini / Strix).
 *  Requires an Authentik session and forwards the gateway Bearer token,
 *  which never reaches the browser. */
export async function proxyGateway(req: NextRequest, path: string, timeoutMs = 320_000) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized', status: 'error' }, { status: 401 })
  const token = process.env.GATEWAY_API_TOKEN
  if (!token) return NextResponse.json({ error: 'GATEWAY_API_TOKEN is not configured on the portal', status: 'error' }, { status: 503 })
  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON body', status: 'error' }, { status: 400 }) }
  try {
    const res = await fetch(`${GATEWAY_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
      cache: 'no-store',
    })
    const text = await res.text()
    let data: unknown
    try { data = JSON.parse(text) } catch { data = { error: text.slice(0, 500), status: 'error' } }
    return NextResponse.json(data, { status: res.status })
  } catch (e) {
    const msg = e instanceof Error && e.name === 'TimeoutError' ? 'Gateway timed out' : 'Could not reach the MCP gateway'
    return NextResponse.json({ error: msg, status: 'error' }, { status: 502 })
  }
}
