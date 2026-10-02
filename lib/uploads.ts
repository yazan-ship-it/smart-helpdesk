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
