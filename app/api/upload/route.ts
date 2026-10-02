import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { randomUUID } from 'crypto'
import path from 'path'
import { getSession } from '@/lib/session'
import { ALLOWED_TYPES, MAX_FILES, MAX_FILE_SIZE, MAX_FILE_SIZE_MB, fileExtension } from '@/lib/uploads'
import type { ErrorCode, ErrorParams } from '@/lib/errors'

/** Errors use the shared codes; the form shows errors.<code> in the user's language */
const error = (code: ErrorCode, status: number, params?: ErrorParams) =>
  NextResponse.json({ error: code, ...(params ? { params } : {}) }, { status })

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return error('unauthorized', 401)

  // Reject oversized bodies before buffering them
  const contentLength = Number(req.headers.get('content-length') ?? 0)
  if (contentLength > MAX_FILES * MAX_FILE_SIZE + 64 * 1024) return error('upload_too_large', 413)

  try {
    const formData = await req.formData()
    const files = formData.getAll('files').filter((f): f is File => f instanceof File)

    if (!files.length) return error('upload_none', 400)
    if (files.length > MAX_FILES) return error('upload_too_many', 400, { max: MAX_FILES })

    for (const file of files) {
      if (!ALLOWED_TYPES[fileExtension(file.name)]) return error('upload_type', 400, { name: file.name })
      if (file.size > MAX_FILE_SIZE) return error('upload_file_too_big', 413, { name: file.name, max: MAX_FILE_SIZE_MB })
    }

    const uploadDir = path.join(process.cwd(), 'public', 'uploads')
    await mkdir(uploadDir, { recursive: true })

    const attachments = await Promise.all(
      files.map(async (file) => {
        const ext = fileExtension(file.name)
        // Random, unguessable name; the extension comes from the allowlist, never from user input
        const storedName = `${randomUUID()}${ext}`
        await writeFile(path.join(uploadDir, storedName), Buffer.from(await file.arrayBuffer()))
        return {
          name: file.name,
          size: file.size,
          type: ALLOWED_TYPES[ext],
          url: `/uploads/${storedName}`,
        }
      })
    )

    return NextResponse.json({ attachments })
  } catch (err) {
    console.error('Upload error:', err)
    return error('failed', 500)
  }
}
