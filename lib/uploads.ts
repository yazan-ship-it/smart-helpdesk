/** Upload rules shared by the upload API and the forms that use it. */

/** Attachments per ticket */
export const MAX_FILES = 5
/**
 * Per file. Vercel functions accept request bodies up to 4.5 MB, so the form
 * uploads one file per request and each file must stay under that.
 */
export const MAX_FILE_SIZE_MB = 4
export const MAX_FILE_SIZE = MAX_FILE_SIZE_MB * 1024 * 1024

// The stored type (and so the Content-Type the file is served with) comes from
// the extension. Only allow types that browsers will not execute (no .html, .svg, .js ...).
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

/** What the pages and the upload API send to the browser about a file */
export type AttachmentInfo = { id: string; name: string; size: number; type: string; url: string }

export const attachmentUrl = (id: string) => `/api/files/${id}`

export function toAttachmentInfo(a: { id: string; name: string; size: number; type: string }): AttachmentInfo {
  return { id: a.id, name: a.name, size: a.size, type: a.type, url: attachmentUrl(a.id) }
}
