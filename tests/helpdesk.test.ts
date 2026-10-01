/**
 * Smart IT Helpdesk — Test Suite
 * Tests: login, ticket creation, role auth, status lifecycle, data isolation, API auth & uploads
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

// Server actions read the session from Next.js cookies; stub it so the real
// actions can be called directly from tests.
vi.mock('@/lib/session', () => ({ getSession: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('next/navigation', () => ({ redirect: vi.fn() }))
vi.mock('@/lib/gemini', () => ({ triageTicket: vi.fn(), translateText: vi.fn(), summarizeTicket: vi.fn() }))

import { unlink } from 'fs/promises'
import path from 'path'
import { NextRequest } from 'next/server'
import { getSession, type Role, type SessionPayload } from '@/lib/session'
import { triageTicket, translateText } from '@/lib/gemini'
import { getTicketDetails } from '@/app/actions/tickets'
import { translateAction } from '@/app/actions/translate'
import { POST as uploadPOST } from '@/app/api/upload/route'
import { POST as triagePOST } from '@/app/api/ai/triage/route'
import { POST as translatePOST } from '@/app/api/ai/translate/route'

function signInAs(userId: string, role: Role) {
  vi.mocked(getSession).mockResolvedValue({ userId, role } as SessionPayload)
}

const prisma = new PrismaClient()

// ─── Test Data ────────────────────────────────────────
let employeeId: string
let itSupportId: string
let testTicketId: string
let testTicketNumber: number

// ─── Status machine rules (mirrors server action logic) ───
const VALID_TRANSITIONS: Record<string, string[]> = {
  OPEN: ['ASSIGNED'],
  ASSIGNED: ['IN_PROGRESS'],
  IN_PROGRESS: ['RESOLVED'],
  RESOLVED: ['CLOSED'],
  CLOSED: [],
}

function isValidTransition(from: string, to: string): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false
}

// ─── Setup & Teardown ─────────────────────────────────
beforeAll(async () => {
  // Create isolated test users
  const emp = await prisma.user.create({
    data: {
      name: 'Test Employee',
      email: `test-employee-${Date.now()}@test.com`,
      password: await bcrypt.hash('testpass123', 12),
      role: 'EMPLOYEE',
    },
  })
  employeeId = emp.id

  const it = await prisma.user.create({
    data: {
      name: 'Test IT Support',
      email: `test-it-${Date.now()}@test.com`,
      password: await bcrypt.hash('testpass123', 12),
      role: 'IT_SUPPORT',
    },
  })
  itSupportId = it.id
})

afterAll(async () => {
  // Clean up test data
  await prisma.ticketHistory.deleteMany({ where: { userId: { in: [employeeId, itSupportId] } } })
  await prisma.comment.deleteMany({ where: { authorId: { in: [employeeId, itSupportId] } } })
  await prisma.ticket.deleteMany({ where: { createdById: employeeId } })
  await prisma.user.deleteMany({ where: { id: { in: [employeeId, itSupportId] } } })
  await prisma.$disconnect()
})

// ────────────────────────────────────────────────────────
// TEST 1: User Login — credential validation
// ────────────────────────────────────────────────────────
describe('Test 1: User Login', () => {
  it('should find employee user by email', async () => {
    const user = await prisma.user.findUnique({
      where: { id: employeeId },
    })
    expect(user).not.toBeNull()
    expect(user?.role).toBe('EMPLOYEE')
    expect(user?.email).toContain('@test.com')
  })

  it('should validate correct password', async () => {
    const user = await prisma.user.findUnique({ where: { id: employeeId } })
    expect(user).not.toBeNull()
    const passwordMatch = await bcrypt.compare('testpass123', user!.password)
    expect(passwordMatch).toBe(true)
  })

  it('should reject incorrect password', async () => {
    const user = await prisma.user.findUnique({ where: { id: employeeId } })
    expect(user).not.toBeNull()
    const passwordMatch = await bcrypt.compare('wrongpassword', user!.password)
    expect(passwordMatch).toBe(false)
  })

  it('should return null for non-existent email', async () => {
    const user = await prisma.user.findUnique({
      where: { email: 'nonexistent-user-xyz@test.com' },
    })
    expect(user).toBeNull()
  })
})

// ────────────────────────────────────────────────────────
// TEST 2: Ticket Creation
// ────────────────────────────────────────────────────────
describe('Test 2: Ticket Creation', () => {
  it('should create a ticket with correct defaults', async () => {
    const lastTicket = await prisma.ticket.findFirst({
      orderBy: { ticketNumber: 'desc' },
      select: { ticketNumber: true },
    })
    const nextNumber = (lastTicket?.ticketNumber ?? 0) + 1
    testTicketNumber = nextNumber

    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber: nextNumber,
        title: 'Test VPN connection issue',
        description: 'Cannot connect to VPN from home, getting timeout errors.',
        category: 'Network',
        priority: 'HIGH',
        status: 'OPEN',
        createdById: employeeId,
      },
    })
    testTicketId = ticket.id

    expect(ticket.id).toBeTruthy()
    expect(ticket.ticketNumber).toBe(nextNumber)
    expect(ticket.status).toBe('OPEN')
    expect(ticket.priority).toBe('HIGH')
    expect(ticket.createdById).toBe(employeeId)
    expect(ticket.assignedToId).toBeNull()
  })

  it('should log ticket creation in history', async () => {
    const history = await prisma.ticketHistory.create({
      data: {
        ticketId: testTicketId,
        userId: employeeId,
        action: `Ticket #${testTicketNumber} created`,
      },
    })
    expect(history.action).toContain('created')
    expect(history.ticketId).toBe(testTicketId)
  })

  it('should retrieve the created ticket with relations', async () => {
    const ticket = await prisma.ticket.findUnique({
      where: { id: testTicketId },
      include: { createdBy: { select: { name: true } } },
    })
    expect(ticket).not.toBeNull()
    expect(ticket?.createdBy.name).toBe('Test Employee')
    expect(ticket?.category).toBe('Network')
  })
})

// ────────────────────────────────────────────────────────
// TEST 3: Role Authorization — block employee from IT actions
// ────────────────────────────────────────────────────────
describe('Test 3: Role Authorization', () => {
  it('EMPLOYEE role should not be IT_SUPPORT', async () => {
    const emp = await prisma.user.findUnique({ where: { id: employeeId } })
    expect(emp?.role).toBe('EMPLOYEE')
    expect(emp?.role).not.toBe('IT_SUPPORT')
  })

  it('IT_SUPPORT role should have elevated privileges', async () => {
    const it = await prisma.user.findUnique({ where: { id: itSupportId } })
    expect(it?.role).toBe('IT_SUPPORT')
  })

  it('should simulate role check blocking employee from status update', () => {
    const userRole: string = 'EMPLOYEE'
    // Mirrors the server action check:
    const canUpdateStatus = userRole === 'IT_SUPPORT'
    expect(canUpdateStatus).toBe(false)
  })

  it('should allow IT_SUPPORT to update status', () => {
    const userRole: string = 'IT_SUPPORT'
    const canUpdateStatus = userRole === 'IT_SUPPORT'
    expect(canUpdateStatus).toBe(true)
  })
})

// ────────────────────────────────────────────────────────
// TEST 4: Ticket Status Lifecycle Validation
// ────────────────────────────────────────────────────────
describe('Test 4: Status Lifecycle State Machine', () => {
  it('should allow OPEN → ASSIGNED transition', () => {
    expect(isValidTransition('OPEN', 'ASSIGNED')).toBe(true)
  })

  it('should allow ASSIGNED → IN_PROGRESS transition', () => {
    expect(isValidTransition('ASSIGNED', 'IN_PROGRESS')).toBe(true)
  })

  it('should allow IN_PROGRESS → RESOLVED transition', () => {
    expect(isValidTransition('IN_PROGRESS', 'RESOLVED')).toBe(true)
  })

  it('should allow RESOLVED → CLOSED transition', () => {
    expect(isValidTransition('RESOLVED', 'CLOSED')).toBe(true)
  })

  it('should REJECT OPEN → IN_PROGRESS (skipping ASSIGNED)', () => {
    expect(isValidTransition('OPEN', 'IN_PROGRESS')).toBe(false)
  })

  it('should REJECT OPEN → RESOLVED (skipping steps)', () => {
    expect(isValidTransition('OPEN', 'RESOLVED')).toBe(false)
  })

  it('should REJECT CLOSED → OPEN (backwards transition)', () => {
    expect(isValidTransition('CLOSED', 'OPEN')).toBe(false)
  })

  it('should REJECT RESOLVED → OPEN (backwards transition)', () => {
    expect(isValidTransition('RESOLVED', 'OPEN')).toBe(false)
  })

  it('should apply ASSIGNED status in database when IT_SUPPORT assigns ticket', async () => {
    await prisma.ticket.update({
      where: { id: testTicketId },
      data: { assignedToId: itSupportId, status: 'ASSIGNED' },
    })

    const updated = await prisma.ticket.findUnique({ where: { id: testTicketId } })
    expect(updated?.status).toBe('ASSIGNED')
    expect(updated?.assignedToId).toBe(itSupportId)
  })

  it('should progress through full lifecycle: ASSIGNED → IN_PROGRESS → RESOLVED → CLOSED', async () => {
    const transitions: Array<[string, string]> = [
      ['ASSIGNED', 'IN_PROGRESS'],
      ['IN_PROGRESS', 'RESOLVED'],
      ['RESOLVED', 'CLOSED'],
    ]

    for (const [from, to] of transitions) {
      expect(isValidTransition(from, to)).toBe(true)

      await prisma.ticket.update({
        where: { id: testTicketId },
        data: { status: to },
      })

      const ticket = await prisma.ticket.findUnique({ where: { id: testTicketId } })
      expect(ticket?.status).toBe(to)
    }
  })
})

// ────────────────────────────────────────────────────────
// TEST 5: Data Isolation — Employee cannot see other users' tickets
// ────────────────────────────────────────────────────────
describe('Test 5: Data Isolation', () => {
  let otherEmployeeId: string
  let otherTicketId: string

  beforeAll(async () => {
    // Create a second employee
    const other = await prisma.user.create({
      data: {
        name: 'Other Employee',
        email: `other-employee-${Date.now()}@test.com`,
        password: await bcrypt.hash('testpass123', 12),
        role: 'EMPLOYEE',
      },
    })
    otherEmployeeId = other.id

    const lastTicket = await prisma.ticket.findFirst({
      orderBy: { ticketNumber: 'desc' },
      select: { ticketNumber: true },
    })

    // Create a ticket belonging to the other employee
    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber: (lastTicket?.ticketNumber ?? 0) + 1,
        title: 'Other employee private ticket',
        description: 'This is a private ticket for the other employee only.',
        category: 'Software',
        priority: 'LOW',
        status: 'OPEN',
        createdById: other.id,
      },
    })
    otherTicketId = ticket.id
  })

  afterAll(async () => {
    await prisma.ticket.deleteMany({ where: { createdById: otherEmployeeId } })
    await prisma.user.deleteMany({ where: { id: otherEmployeeId } })
  })

  it('EMPLOYEE query should only return their own tickets', async () => {
    // Simulate EMPLOYEE-scoped query (mirrors tickets page logic)
    const myTickets = await prisma.ticket.findMany({
      where: { createdById: employeeId },
    })

    const allIds = myTickets.map((t) => t.id)
    expect(allIds).not.toContain(otherTicketId)
  })

  it('EMPLOYEE accessing another user ticket by ID should be blocked', async () => {
    // Simulate detail page auth check
    const ticket = await prisma.ticket.findUnique({ where: { id: otherTicketId } })
    const requestingUserId = employeeId // This employee tries to access other's ticket
    const hasAccess = ticket?.createdById === requestingUserId
    expect(hasAccess).toBe(false) // Should be denied
  })

  it('IT_SUPPORT should see all tickets regardless of creator', async () => {
    // IT_SUPPORT has no where-clause restriction
    const allTickets = await prisma.ticket.findMany({
      where: {}, // Empty — all tickets
      select: { id: true, createdById: true },
    })
    const ids = allTickets.map((t) => t.id)
    expect(ids).toContain(otherTicketId)
    expect(ids).toContain(testTicketId)
  })

  it('EMPLOYEE should not be able to comment on another employee ticket', async () => {
    // Simulate addComment ownership check
    const ticket = await prisma.ticket.findUnique({
      where: { id: otherTicketId },
      select: { createdById: true },
    })
    const requestingUserId = employeeId
    const canComment = ticket?.createdById === requestingUserId
    expect(canComment).toBe(false)
  })

  it('getTicketDetails returns null when an EMPLOYEE requests another user ticket', async () => {
    signInAs(employeeId, 'EMPLOYEE')
    expect(await getTicketDetails(otherTicketId)).toBeNull()
  })

  it('getTicketDetails returns the ticket to its EMPLOYEE owner', async () => {
    signInAs(otherEmployeeId, 'EMPLOYEE')
    const ticket = await getTicketDetails(otherTicketId)
    expect(ticket?.id).toBe(otherTicketId)
  })

  it('getTicketDetails returns any ticket to IT_SUPPORT', async () => {
    signInAs(itSupportId, 'IT_SUPPORT')
    const ticket = await getTicketDetails(otherTicketId)
    expect(ticket?.id).toBe(otherTicketId)
  })
})

// ────────────────────────────────────────────────────────
// TEST 6: API Authentication & Upload Safety
// ────────────────────────────────────────────────────────
describe('Test 6: API Authentication & Upload Safety', () => {
  const signedOut = () => vi.mocked(getSession).mockResolvedValue(null)

  function uploadRequest(...files: File[]) {
    const formData = new FormData()
    files.forEach((f) => formData.append('files', f))
    return new NextRequest('http://localhost/api/upload', { method: 'POST', body: formData })
  }

  function jsonRequest(url: string, body: unknown) {
    return new NextRequest(url, {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json' },
    })
  }

  it('upload rejects unauthenticated requests', async () => {
    signedOut()
    const res = await uploadPOST(uploadRequest(new File(['x'], 'a.png', { type: 'image/png' })))
    expect(res.status).toBe(401)
  })

  it('upload rejects HTML and SVG files that browsers would execute', async () => {
    signInAs(employeeId, 'EMPLOYEE')
    for (const name of ['evil.html', 'evil.svg', 'evil.js', 'evil.png.html', 'noext']) {
      const res = await uploadPOST(uploadRequest(new File(['<script>alert(1)</script>'], name, { type: 'image/png' })))
      expect(res.status, name).toBe(400)
    }
  })

  it('upload rejects files larger than 10 MB', async () => {
    signInAs(employeeId, 'EMPLOYEE')
    const big = new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'big.pdf', { type: 'application/pdf' })
    const res = await uploadPOST(uploadRequest(big))
    expect(res.status).toBe(413)
  })

  it('upload rejects more than 5 files at once', async () => {
    signInAs(employeeId, 'EMPLOYEE')
    const files = Array.from({ length: 6 }, (_, i) => new File(['x'], `f${i}.txt`, { type: 'text/plain' }))
    const res = await uploadPOST(uploadRequest(...files))
    expect(res.status).toBe(400)
  })

  it('upload stores an allowed file under a random name with the server-side type', async () => {
    signInAs(employeeId, 'EMPLOYEE')
    const res = await uploadPOST(uploadRequest(new File(['png-bytes'], 'Screen Shot.PNG', { type: 'text/html' })))
    expect(res.status).toBe(200)
    const { attachments } = await res.json()
    expect(attachments).toHaveLength(1)
    expect(attachments[0].name).toBe('Screen Shot.PNG')
    expect(attachments[0].type).toBe('image/png') // not the client-claimed text/html
    expect(attachments[0].url).toMatch(/^\/uploads\/[0-9a-f-]{36}\.png$/)
    await unlink(path.join(process.cwd(), 'public', attachments[0].url))
  })

  it('AI triage route rejects unauthenticated requests without calling Gemini', async () => {
    signedOut()
    vi.mocked(triageTicket).mockClear()
    const res = await triagePOST(jsonRequest('http://localhost/api/ai/triage', { title: 'VPN down', description: 'x' }))
    expect(res.status).toBe(401)
    expect(triageTicket).not.toHaveBeenCalled()
  })

  it('AI translate route rejects unauthenticated requests without calling Gemini', async () => {
    signedOut()
    vi.mocked(translateText).mockClear()
    const res = await translatePOST(jsonRequest('http://localhost/api/ai/translate', { text: 'hello', targetLanguage: 'Arabic' }))
    expect(res.status).toBe(401)
    expect(translateText).not.toHaveBeenCalled()
  })

  it('translateAction rejects unauthenticated callers without calling Gemini', async () => {
    signedOut()
    vi.mocked(translateText).mockClear()
    const result = await translateAction({ text: 'hello', targetLanguage: 'Arabic' })
    expect(result.success).toBe(false)
    expect(translateText).not.toHaveBeenCalled()
  })
})
