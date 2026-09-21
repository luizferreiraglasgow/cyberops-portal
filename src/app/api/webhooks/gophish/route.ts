import { NextRequest, NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'node:crypto'

// R2.6 - GoPhish webhook receiver.
// GoPhish webhooks are global (single URL, all campaigns). We verify HMAC-SHA256
// against GOPHISH_WEBHOOK_SECRET, map GoPhish int campaign_id to the portal
// campaign UUID via campaign.gophish_campaign_id, and insert into event via
// Supabase REST using the service_role key.

const SECRET = process.env.GOPHISH_WEBHOOK_SECRET
const SB_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

export const maxDuration = 30

function mapMessage(msg: string): { event_type: string; zone: 'A' | 'B' } | null {
  const m = (msg || '').toLowerCase()
  if (m.includes('email sent')) return { event_type: 'arrival', zone: 'A' }
  if (m.includes('email opened')) return { event_type: 'interaction', zone: 'A' }
  if (m.includes('clicked link')) return { event_type: 'interaction', zone: 'A' }
  if (m.includes('submitted data')) return { event_type: 'simulated_submission', zone: 'B' }
  if (m.includes('email reported')) return { event_type: 'report', zone: 'A' }
  return null
}

function verify(body: string, header: string): boolean {
  if (!SECRET || !header) return false
  const sigHex = header.startsWith('sha256=') ? header.slice(7) : header
  const expected = createHmac('sha256', SECRET).update(body).digest('hex')
  try {
    const a = Buffer.from(expected, 'hex')
    const b = Buffer.from(sigHex, 'hex')
    if (a.length !== b.length) return false
    return timingSafeEqual(a, b)
  } catch { return false }
}

async function sb(path: string, init?: RequestInit) {
  return fetch(SB_URL + '/rest/v1' + path, {
    ...init,
    headers: {
      apikey: SB_KEY,
      Authorization: 'Bearer ' + SB_KEY,
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  })
}

export async function POST(req: NextRequest) {
  if (!SECRET) return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 })
  if (!SB_URL || !SB_KEY) return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 })

  const rawBody = await req.text()
  const signature = req.headers.get('x-gophish-signature') || ''
  if (!verify(rawBody, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let payload: Record<string, unknown>
  try { payload = JSON.parse(rawBody) } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const gpCampId = Number(payload.campaign_id)
  const email = String(payload.email || '')
  const message = String(payload.message || '')
  const time = typeof payload.time === 'string' ? payload.time : new Date().toISOString()

  if (!Number.isFinite(gpCampId) || !email || !message) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const mapping = mapMessage(message)
  if (!mapping) {
    return NextResponse.json({ status: 'ignored', reason: 'unknown message', message }, { status: 200 })
  }

  const cRes = await sb('/campaign?gophish_campaign_id=eq.' + gpCampId + '&select=*')
  const camps = await cRes.json().catch(() => null)
  const campaign = Array.isArray(camps) ? camps[0] : null
  if (!campaign) {
    return NextResponse.json({ status: 'ignored', reason: 'no portal campaign mapped', gophish_campaign_id: gpCampId }, { status: 200 })
  }

  const row = {
    campaign_id: campaign.id,
    client_id: campaign.client_id,
    engagement_id: campaign.engagement_id,
    authorization_ref: campaign.authorization_ref,
    target_id: 'email:' + email,
    event_type: mapping.event_type,
    zone: mapping.zone,
    source: 'gophish',
    occurred_at: time,
  }

  const iRes = await sb('/event', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify([row]),
  })

  if (!iRes.ok) {
    const errText = await iRes.text().catch(() => '')
    return NextResponse.json({ error: 'Insert failed', details: errText.slice(0, 500) }, { status: 500 })
  }

  return NextResponse.json({
    status: 'ok',
    campaign_id: campaign.id,
    event_type: mapping.event_type,
    zone: mapping.zone,
    occurred_at: time,
  }, { status: 201 })
}
