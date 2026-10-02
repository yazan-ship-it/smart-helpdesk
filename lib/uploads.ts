/** Upload rules shared by the upload API and the forms that use it. */

export const MAX_FILES = 5
export const MAX_FILE_SIZE_MB = 10
export const MAX_FILE_SIZE = MAX_FILE_SIZE_MB * 1024 * 1024

// Files are served straight from /public, where the extension decides the
// Content-Type. Only allow types that browsers will not execute (no .html, .svg, .js ...).
export const ALLOWED_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain',
  '.log': 'text/plain',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.zip': 'application/zip',
}

/** Value for an <input type="file" accept="…"> */
export const ACCEPT_ATTRIBUTE = Object.keys(ALLOWED_TYPES).join(',')

export function fileExtension(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot === -1 ? '' : name.slice(dot).toLowerCase()
}

export type Attachment = { name: string; size: number; type: string; url: string }

/** Where the upload API stores files: a random UUID plus an allowed extension */
const UPLOAD_URL = /^\/uploads\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(\.[a-z]+)$/

/**
 * Attachment metadata comes back from the browser, so check that it only
 * points at files the upload API created. Returns null if anything is off.
 */
export function parseAttachments(json: string | null | undefined): Attachment[] | null {
  let list: unknown
  try {
    list = JSON.parse(json || '[]')
  } catch {
    return null
  }
  if (!Array.isArray(list) || list.length > MAX_FILES) return null

  const result: Attachment[] = []
  for (const item of list) {
    if (typeof item !== 'object' || item === null) return null
    const { name, size, url } = item as Record<string, unknown>
    const match = typeof url === 'string' ? url.match(UPLOAD_URL) : null
    if (!match || !ALLOWED_TYPES[match[1]]) return null
    if (typeof name !== 'string' || !name.trim() || name.length > 255) return null
    if (typeof size !== 'number' || !Number.isFinite(size) || size < 0 || size > MAX_FILE_SIZE) return null
    // The type is derived from the stored file's extension, not taken from the client
    result.push({ name: name.trim(), size, type: ALLOWED_TYPES[match[1]], url: match[0] })
  }
  return result
}
