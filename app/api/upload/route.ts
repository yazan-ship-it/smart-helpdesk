import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'

export async function POST(req: NextRequest) {
 try {
 const formData = await req.formData()
 const files = formData.getAll('files') as File[]

 if (!files.length) {
 return NextResponse.json({ error: 'No files provided' }, { status: 400 })
 }

 const uploadDir = path.join(process.cwd(), 'public', 'uploads')
 await mkdir(uploadDir, { recursive: true })

 const attachments = await Promise.all(
 files.map(async (file) => {
 const bytes = await file.arrayBuffer()
 const buffer = Buffer.from(bytes)
 const safeName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
 const filePath = path.join(uploadDir, safeName)
 await writeFile(filePath, buffer)
 return {
 name: file.name,
 size: file.size,
 type: file.type,
 url: `/uploads/${safeName}`,
 }
 })
 )

 return NextResponse.json({ attachments })
 } catch (err) {
 console.error('Upload error:', err)
 return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
 }
}
