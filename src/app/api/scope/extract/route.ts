import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { extractScopeText, MAX_SCOPE_CHARS } from '@/lib/scopeExtract'

export const runtime = 'nodejs'
export const maxDuration = 60

const MAX_BYTES = 8 * 1024 * 1024 // 8 MB

// Extracts plain text from an uploaded scope document (PDF / DOCX / TXT / MD)
// so the Scope Analyzer can send the real document to Gemini. Auth required.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 })

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Expected a file upload (multipart/form-data).' }, { status: 400 })
  }

  const file = form.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file provided.' }, { status: 400 })
  }
  if (file.size === 0) {
    return NextResponse.json({ error: 'The file is empty.' }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'File too large (max 8 MB).' }, { status: 413 })
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    const text = await extractScopeText(buffer, file.name, file.type)
    if (!text.trim()) {
      return NextResponse.json(
        { error: 'No readable text found (a scanned/image-only PDF cannot be read).' },
        { status: 422 },
      )
    }
    return NextResponse.json({
      filename: file.name,
      chars: text.length,
      truncated: text.length >= MAX_SCOPE_CHARS,
      text,
    })
  } catch {
    return NextResponse.json(
      { error: 'Could not read this document. Try a PDF, DOCX or TXT file.' },
      { status: 422 },
    )
  }
}
