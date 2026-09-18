// Authorization helper for campaign endpoints.
// Two acceptable identities:
//   1. Authentik-authenticated portal user (UI-driven actions in the Workspace).
//   2. The node-02 campaign runner, presenting a shared Bearer token
//      (env CAMPAIGN_RUNNER_TOKEN — server-side only).
// Never accept a runner token from the browser: only same-origin fetch from the
// portal UI hits these routes without a token, and next-auth verifies its session.
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

const RUNNER_TOKEN = process.env.CAMPAIGN_RUNNER_TOKEN

export type Caller = { kind: 'session'; who: string } | { kind: 'runner' }

/** Returns the caller on success, or a NextResponse to short-circuit with 401/503. */
export async function authorizeCampaignCall(
  req: NextRequest,
): Promise<Caller | NextResponse> {
  const auth = req.headers.get('authorization') ?? ''
  const m = /^Bearer\s+(.+)$/i.exec(auth)
  if (m && RUNNER_TOKEN) {
    // constant-time compare, minimal — the token is a fixed-length random string
    if (m[1].length === RUNNER_TOKEN.length && m[1] === RUNNER_TOKEN) {
      return { kind: 'runner' }
    }
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const who = (session.user?.email ?? session.user?.name ?? 'session') as string
  return { kind: 'session', who }
}
