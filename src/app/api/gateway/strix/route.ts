import { NextRequest } from 'next/server'
import { proxyGateway } from '@/lib/gateway'
export const maxDuration = 60 // Vercel Hobby limit; the gateway keeps running the scan on node-02 (max 300s)
export async function POST(req: NextRequest) { return proxyGateway(req, '/mcp/strix', 55_000) }
