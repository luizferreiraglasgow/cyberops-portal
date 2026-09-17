// Server-only Supabase REST (PostgREST) helper for the Social Engineering module.
// Uses the service_role key, which BYPASSES RLS — NEVER import this from a client
// component. All access is mediated here, server-side; tenant scoping is enforced by
// the callers in @/lib/campaigns. Zone A only; no RDM link, no credential persistence.
import { NextResponse } from 'next/server'

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY

export type SupabaseResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: string }

export type SupabaseError = Extract<SupabaseResult<unknown>, { ok: false }>

export function supabaseConfigured(): boolean {
  return !!SUPABASE_URL && !!SERVICE_ROLE
}

/** Low-level PostgREST call. Returns parsed JSON or a structured error. */
export async function supabaseRest<T = unknown>(
  path: string,
  init: RequestInit & { prefer?: string } = {},
): Promise<SupabaseResult<T>> {
  if (!SUPABASE_URL || !SERVICE_ROLE) {
    return {
      ok: false,
      status: 503,
      error: 'Supabase is not configured on the portal (set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY).',
    }
  }
  const { prefer, headers, ...rest } = init
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
      ...rest,
      headers: {
        apikey: SERVICE_ROLE,
        Authorization: `Bearer ${SERVICE_ROLE}`,
        'Content-Type': 'application/json',
        ...(prefer ? { Prefer: prefer } : {}),
        ...headers,
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    })
    const text = await res.text()
    let data: unknown = null
    if (text) {
      try { data = JSON.parse(text) } catch { data = text }
    }
    if (!res.ok) {
      const msg =
        data && typeof data === 'object' && 'message' in data
          ? String((data as { message: unknown }).message)
          : `Supabase error ${res.status}`
      return { ok: false, status: res.status, error: msg }
    }
    return { ok: true, data: data as T }
  } catch (e) {
    const msg = e instanceof Error && e.name === 'TimeoutError' ? 'Supabase request timed out' : 'Could not reach Supabase'
    return { ok: false, status: 502, error: msg }
  }
}

/** Uniform structured error → NextResponse, for route handlers. */
export function supabaseErrorResponse(r: SupabaseError) {
  return NextResponse.json({ error: r.error, status: 'error' }, { status: r.status })
}
