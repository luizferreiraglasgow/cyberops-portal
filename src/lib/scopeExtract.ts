// Server-side text extraction for uploaded scope documents (PDF / DOCX / TXT / MD).
// Kept dependency-light and serverless-friendly: `unpdf` bundles a serverless
// build of pdf.js, `mammoth` reads .docx. Plain text is decoded directly.

export const MAX_SCOPE_CHARS = 20_000

function clean(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, MAX_SCOPE_CHARS)
}

export async function extractScopeText(
  buffer: Buffer,
  filename: string,
  mimeType?: string,
): Promise<string> {
  const name = (filename || '').toLowerCase()
  const isPdf = name.endsWith('.pdf') || mimeType === 'application/pdf'
  const isDocx =
    name.endsWith('.docx') ||
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

  if (isPdf) {
    const { extractText, getDocumentProxy } = await import('unpdf')
    const pdf = await getDocumentProxy(new Uint8Array(buffer))
    const { text } = await extractText(pdf, { mergePages: true })
    return clean(Array.isArray(text) ? text.join('\n') : text)
  }

  if (isDocx) {
    const mammoth = await import('mammoth')
    const { value } = await mammoth.extractRawText({ buffer })
    return clean(value)
  }

  // .txt / .md / anything else: decode as UTF-8 text
  return clean(buffer.toString('utf-8'))
}
