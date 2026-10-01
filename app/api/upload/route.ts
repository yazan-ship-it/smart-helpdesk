import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { randomUUID } from 'crypto'
import path from 'path'
import { getSession } from '@/lib/session'

const MAX_FILES = 5
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB

// Files are served straight from /public, where the extension decides the
// Content-Type. Only allow types that browsers will not execute (no .html, .svg, .js ...).
const ALLOWED_TYPES: Record<string, string> = {
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

export async function POST(req: NextRequest) {
 const session = await getSession()
 if (!session) {
 return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
 }

 // Reject oversized bodies before buffering them
 const contentLength = Number(req.headers.get('content-length') ?? 0)
 if (contentLength > MAX_FILES * MAX_FILE_SIZE + 64 * 1024) {
 return NextResponse.json({ error: 'Upload too large' }, { status: 413 })
 }

 try {
 const formData = await req.formData()
 const files = formData.getAll('files').filter((f): f is File => f instanceof File)

 if (!files.length) {
 return NextResponse.json({ error: 'No files provided' }, { status: 400 })
 }
 if (files.length > MAX_FILES) {
 return NextResponse.json({ error: `You can upload up to ${MAX_FILES} files at a time` }, { status: 400 })
 }

 for (const file of files) {
 const ext = path.extname(file.name).toLowerCase()
 if (!ALLOWED_TYPES[ext]) {
 return NextResponse.json({ error: `File type not allowed: ${file.name}` }, { status: 400 })
 }
 if (file.size > MAX_FILE_SIZE) {
 return NextResponse.json({ error: `File is larger than 10 MB: ${file.name}` }, { status: 413 })
 }
 }

 const uploadDir = path.join(process.cwd(), 'public', 'uploads')
 await mkdir(uploadDir, { recursive: true })

 const attachments = await Promise.all(
 files.map(async (file) => {
 const ext = path.extname(file.name).toLowerCase()
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
 return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
 }
}
