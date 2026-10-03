import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/session'
import { getStorage } from '@/lib/storage'
import { ALLOWED_TYPES, MAX_FILES, MAX_FILE_SIZE, MAX_FILE_SIZE_MB, MAX_PENDING_UPLOADS, fileExtension, toAttachmentInfo } from '@/lib/uploads'
import { recordAttempt, retryAfter, UPLOAD_PER_USER } from '@/lib/rate-limit'
import type { ErrorCode, ErrorParams } from '@/lib/errors'

/** Errors use the shared codes; the form shows errors.<code> in the user's language */
const error = (code: ErrorCode, status: number, params?: ErrorParams) =>
  NextResponse.json({ error: code, ...(params ? { params } : {}) }, { status })

/** Uploads that never became part of a ticket are removed after a day */
const ABANDONED_AFTER_MS = 24 * 60 * 60 * 1000

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return error('unauthorized', 401)

  // Per-user upload limit, checked before reading the body
  const limitKey = `upload:user:${session.userId}`
  const wait = await retryAfter(limitKey, UPLOAD_PER_USER)
  if (wait > 0) return error('too_many_attempts', 429, { minutes: Math.ceil(wait / 60_000) })

  // Reject oversized bodies before buffering them
  const contentLength = Number(req.headers.get('content-length') ?? 0)
  if (contentLength > MAX_FILES * MAX_FILE_SIZE + 64 * 1024) return error('upload_too_large', 413)

  let files: File[]
  try {
    files = (await req.formData()).getAll('files').filter((f): f is File => f instanceof File)
  } catch {
    return error('upload_none', 400)
  }

  if (!files.length) return error('upload_none', 400)
  if (files.length > MAX_FILES) return error('upload_too_many', 400, { max: MAX_FILES })

  for (const file of files) {
    if (!ALLOWED_TYPES[fileExtension(file.name)]) return error('upload_type', 400, { name: file.name })
    if (file.size > MAX_FILE_SIZE) return error('upload_file_too_big', 413, { name: file.name, max: MAX_FILE_SIZE_MB })
  }

  const storage = getStorage()
  try {
    await removeAbandonedUploads(session.userId)

    // Files uploaded but not yet attached to a ticket are capped too
    const pending = await prisma.attachment.count({ where: { uploadedById: session.userId, ticketId: null } })
    if (pending + files.length > MAX_PENDING_UPLOADS) {
      return error('upload_pending_limit', 429, { max: MAX_PENDING_UPLOADS })
    }

    const attachments = []
    for (const file of files) {
      const ext = fileExtension(file.name)
      // Random, unguessable key; the extension comes from the allowlist, never from user input
      const storageKey = `${randomUUID()}${ext}`
      await recordAttempt(limitKey, UPLOAD_PER_USER)
      await storage.put(storageKey, Buffer.from(await file.arrayBuffer()), ALLOWED_TYPES[ext])
      const row = await prisma.attachment.create({
        data: {
          storageKey,
          name: file.name.slice(0, 255),
          size: file.size,
          type: ALLOWED_TYPES[ext],
          uploadedById: session.userId,
        },
      })
      attachments.push(toAttachmentInfo(row))
    }
    return NextResponse.json({ attachments })
  } catch (err) {
    console.error('Upload error:', err)
    return error('failed', 500)
  }
}

async function removeAbandonedUploads(userId: string) {
  const abandoned = await prisma.attachment.findMany({
    where: { uploadedById: userId, ticketId: null, createdAt: { lt: new Date(Date.now() - ABANDONED_AFTER_MS) } },
    select: { id: true, storageKey: true },
  })
  if (!abandoned.length) return
  const storage = getStorage()
  await Promise.all(abandoned.map((a) => storage.delete(a.storageKey)))
  await prisma.attachment.deleteMany({ where: { id: { in: abandoned.map((a) => a.id) } } })
}
