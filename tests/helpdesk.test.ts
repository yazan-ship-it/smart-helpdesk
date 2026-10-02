/**
 * Smart IT Helpdesk — Test Suite
 *
 * Every test calls the real server actions, pages and route handlers against the
 * database. Only the Next.js request context (session cookie, redirect, notFound,
 * revalidatePath) and the Gemini client are stubbed.
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

// Server code reads the session from Next.js cookies; stub it so tests can pick the user.
vi.mock('@/lib/session', () => ({
  getSession: vi.fn(),
  createSession: vi.fn(),
  deleteSession: vi.fn(),
  decrypt: vi.fn(),
  SESSION_COOKIE: 'helpdesk-session',
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
// Like the real ones, redirect() and notFound() throw to stop the action.
vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`)
  }),
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND')
  }),
}))
vi.mock('@/lib/gemini', () => ({
  isAiConfigured: vi.fn(() => true),
  triageTicket: vi.fn(),
  translateText: vi.fn(),
  summarizeTicket: vi.fn(),
  AiNotConfiguredError: class AiNotConfiguredError extends Error {},
}))
// Pages are called directly; their client components only receive props.
vi.mock('@/app/tickets/TicketListClient', () => ({ default: () => null }))
vi.mock('@/app/tickets/[id]/TicketDetailClient', () => ({ default: () => null }))
vi.mock('@/app/admin/users/AdminUsersClient', () => ({ default: () => null }))

import { unlink } from 'fs/promises'
import path from 'path'
import type { ReactElement } from 'react'
import { NextRequest } from 'next/server'
import { getSession, createSession, decrypt, type Role, type SessionPayload } from '@/lib/session'
import { AiNotConfiguredError, isAiConfigured, summarizeTicket, triageTicket, translateText } from '@/lib/gemini'
import { login } from '@/app/actions/auth'
import {
  createTicket,
  updateTicketStatus,
  confirmTicketResolution,
  reopenTicket,
  assignTicket,
  takeOverTicket,
  reassignTicket,
  addComment,
  getTicketDetails,
} from '@/app/actions/tickets'
import { inviteUser, updateUserRole, updateUserStatus } from '@/app/actions/admin'
import { changePassword } from '@/app/actions/account'
import proxy from '@/proxy'
import { translateAction } from '@/app/actions/translate'
import { updateSettings, type SettingsInput } from '@/app/actions/settings'
import TicketsPage from '@/app/tickets/page'
import TicketDetailPage from '@/app/tickets/[id]/page'
import AdminTicketsPage from '@/app/admin/tickets/page'
import AdminUsersPage from '@/app/admin/users/page'
import { POST as uploadPOST } from '@/app/api/upload/route'
import { POST as triagePOST } from '@/app/api/ai/triage/route'
import { POST as summarizePOST } from '@/app/api/ai/summarize/[id]/route'

const prisma = new PrismaClient()

// ─── Test Data ────────────────────────────────────────
const PASSWORD = 'testpass123'
const stamp = Date.now()
const employeeEmail = `test-employee-${stamp}@test.com`
const itSupportEmail = `test-it-${stamp}@test.com`
const pendingEmail = `test-pending-${stamp}@test.com`

let employeeId: string
let itSupportId: string
let itPeerId: string
let adminId: string
const testUserIds: string[] = []

function signInAs(userId: string, role: Role, name = 'Test User', extra: Partial<SessionPayload> = {}) {
  vi.mocked(getSession).mockResolvedValue({ userId, role, name, ...extra } as SessionPayload)
}

function signedOut() {
  vi.mocked(getSession).mockResolvedValue(null)
}

async function createUser(name: string, email: string, role: Role, accountStatus = 'APPROVED') {
  const user = await prisma.user.create({
    data: { name, email, role, accountStatus, password: await bcrypt.hash(PASSWORD, 4) },
  })
  testUserIds.push(user.id)
  return user.id
}

async function createTestTicket(
  createdById: string,
  data: { status?: string; assignedToId?: string; slaDeadline?: Date; slaBreached?: boolean } = {}
) {
  const last = await prisma.ticket.findFirst({ orderBy: { ticketNumber: 'desc' }, select: { ticketNumber: true } })
  const ticket = await prisma.ticket.create({
    data: {
      ticketNumber: (last?.ticketNumber ?? 0) + 1,
      title: 'Test ticket',
      description: 'Test ticket description',
      category: 'Network',
      priority: 'MEDIUM',
      createdById,
      ...data,
    },
  })
  return ticket.id
}

async function statusOf(ticketId: string) {
  return (await prisma.ticket.findUnique({ where: { id: ticketId } }))?.status
}

function form(fields: Record<string, string>) {
  const fd = new FormData()
  for (const [k, v] of Object.entries(fields)) fd.set(k, v)
  return fd
}

// ─── Setup & Teardown ─────────────────────────────────
beforeAll(async () => {
  employeeId = await createUser('Test Employee', employeeEmail, 'EMPLOYEE')
  itSupportId = await createUser('Test IT Support', itSupportEmail, 'IT_SUPPORT')
  itPeerId = await createUser('Test IT Peer', `test-it-peer-${stamp}@test.com`, 'IT_SUPPORT')
  adminId = await createUser('Test Admin', `test-admin-${stamp}@test.com`, 'ADMIN')
  await createUser('Test Pending', pendingEmail, 'EMPLOYEE', 'PENDING')
})

afterAll(async () => {
  // Tickets cascade to their comments and history
  await prisma.ticket.deleteMany({ where: { createdById: { in: testUserIds } } })
  await prisma.ticketHistory.deleteMany({ where: { userId: { in: testUserIds } } })
  await prisma.comment.deleteMany({ where: { authorId: { in: testUserIds } } })
  await prisma.user.deleteMany({ where: { id: { in: testUserIds } } })
  await prisma.$disconnect()
})

// ────────────────────────────────────────────────────────
// TEST 1: User Login — the real login action
// ────────────────────────────────────────────────────────
describe('Test 1: User Login', () => {
  it('valid credentials create a session for the user and redirect to their tickets', async () => {
    vi.mocked(createSession).mockClear()
    await expect(login(undefined, form({ email: employeeEmail, password: PASSWORD }))).rejects.toThrow(
      /^NEXT_REDIRECT \/tickets$/
    )
    expect(createSession).toHaveBeenCalledWith(
      { userId: employeeId, role: 'EMPLOYEE', name: 'Test Employee', email: employeeEmail, mustChangePassword: false },
      { remember: false },
    )
    const user = await prisma.user.findUnique({ where: { id: employeeId } })
    expect(user?.lastLoginAt).not.toBeNull()
  })

  it('IT_SUPPORT is redirected to their assigned queue', async () => {
    await expect(login(undefined, form({ email: itSupportEmail, password: PASSWORD }))).rejects.toThrow(
      'NEXT_REDIRECT /tickets?queue=assigned_to_me'
    )
  })

  it('wrong password is rejected without creating a session', async () => {
    vi.mocked(createSession).mockClear()
    const result = await login(undefined, form({ email: employeeEmail, password: 'wrongpassword' }))
    expect(result).toEqual({ error: 'invalid_credentials' })
    expect(createSession).not.toHaveBeenCalled()
  })

  it('unknown email gets the same generic error (no account enumeration)', async () => {
    const result = await login(undefined, form({ email: `nobody-${stamp}@test.com`, password: PASSWORD }))
    expect(result).toEqual({ error: 'invalid_credentials' })
  })

  it('"remember me" asks for a long-lived session, and email case does not matter', async () => {
    vi.mocked(createSession).mockClear()
    await expect(
      login(undefined, form({ email: employeeEmail.toUpperCase(), password: PASSWORD, rememberMe: 'on' }))
    ).rejects.toThrow('NEXT_REDIRECT')
    expect(vi.mocked(createSession).mock.lastCall?.[1]).toEqual({ remember: true })
  })

  it('maintenance mode keeps everyone but admins out', async () => {
    const setting = await prisma.appSettings.findUnique({ where: { id: 'singleton' }, select: { maintenanceMode: true } })
    try {
      await prisma.appSettings.update({ where: { id: 'singleton' }, data: { maintenanceMode: true } })
      expect(await login(undefined, form({ email: employeeEmail, password: PASSWORD }))).toEqual({ error: 'maintenance' })
      await expect(
        login(undefined, form({ email: `test-admin-${stamp}@test.com`, password: PASSWORD }))
      ).rejects.toThrow('NEXT_REDIRECT /admin/users')
    } finally {
      if (setting) await prisma.appSettings.update({ where: { id: 'singleton' }, data: setting })
    }
  })

  it('accounts pending approval cannot log in', async () => {
    vi.mocked(createSession).mockClear()
    const result = await login(undefined, form({ email: pendingEmail, password: PASSWORD }))
    expect(result).toEqual({ error: 'pending' })
    expect(createSession).not.toHaveBeenCalled()
  })
})

// ────────────────────────────────────────────────────────
// TEST 2: Ticket Creation — the real createTicket action
// ────────────────────────────────────────────────────────
describe('Test 2: Ticket Creation', () => {
  it('creates an OPEN ticket with the next number, an SLA deadline and an audit entry', async () => {
    signInAs(employeeId, 'EMPLOYEE')
    const before = await prisma.ticket.aggregate({ _max: { ticketNumber: true } })

    await expect(
      createTicket(
        undefined,
        form({
          title: 'VPN keeps disconnecting',
          description: 'Cannot stay connected to the VPN from home for more than a minute.',
          category: 'Network',
          priority: 'HIGH',
        })
      )
    ).rejects.toThrow('NEXT_REDIRECT /tickets?created=true')

    const ticket = await prisma.ticket.findFirst({
      where: { createdById: employeeId, title: 'VPN keeps disconnecting' },
      include: { ticketHistories: true },
    })
    expect(ticket).not.toBeNull()
    expect(ticket!.status).toBe('OPEN')
    expect(ticket!.priority).toBe('HIGH')
    expect(ticket!.assignedToId).toBeNull()
    expect(ticket!.ticketNumber).toBe((before._max.ticketNumber ?? 0) + 1)
    expect(ticket!.slaDeadline!.getTime()).toBeGreaterThan(ticket!.createdAt.getTime())
    expect(ticket!.ticketHistories.map((h) => h.action)).toContain(`Ticket #${ticket!.ticketNumber} created`)
  })

  it('rejects missing or too-short fields without creating a ticket', async () => {
    signInAs(employeeId, 'EMPLOYEE')
    const countBefore = await prisma.ticket.count({ where: { createdById: employeeId } })

    const result = await createTicket(undefined, form({ title: 'VPN', description: 'broken', category: '' }))

    expect(result?.fieldErrors?.title).toBeDefined()
    expect(result?.fieldErrors?.description).toBeDefined()
    expect(result?.fieldErrors?.category).toBeDefined()
    expect(await prisma.ticket.count({ where: { createdById: employeeId } })).toBe(countBefore)
  })

  it('auto-assigns to a matching agent only when the admin setting is on', async () => {
    const setting = await prisma.appSettings.findUnique({ where: { id: 'singleton' }, select: { autoAssignmentEnabled: true } })
    await prisma.user.update({ where: { id: itSupportId }, data: { skills: JSON.stringify(['Security']), isAvailable: true } })
    const submit = (title: string) =>
      expect(
        createTicket(undefined, form({ title, description: 'Suspicious login alert on my account.', category: 'Security' }))
      ).rejects.toThrow('NEXT_REDIRECT')

    try {
      signInAs(employeeId, 'EMPLOYEE')
      await prisma.appSettings.update({ where: { id: 'singleton' }, data: { autoAssignmentEnabled: false } })
      await submit('Auto-assign off ticket')
      const off = await prisma.ticket.findFirst({ where: { createdById: employeeId, title: 'Auto-assign off ticket' } })
      expect(off).toMatchObject({ status: 'OPEN', assignedToId: null })

      await prisma.appSettings.update({ where: { id: 'singleton' }, data: { autoAssignmentEnabled: true } })
      await submit('Auto-assign on ticket')
      const on = await prisma.ticket.findFirst({ where: { createdById: employeeId, title: 'Auto-assign on ticket' } })
      expect(on?.status).toBe('ASSIGNED')
      expect(on?.assignedToId).not.toBeNull()
    } finally {
      if (setting) await prisma.appSettings.update({ where: { id: 'singleton' }, data: setting })
      await prisma.user.update({ where: { id: itSupportId }, data: { skills: '[]' } })
    }
  })

  it('auto-assignment understands agents saved with the old skill names', async () => {
    const setting = await prisma.appSettings.findUnique({ where: { id: 'singleton' }, select: { autoAssignmentEnabled: true } })
    // Make the test agent the only available Email specialist, using the legacy "Email" name
    const others = await prisma.user.findMany({ where: { role: 'IT_SUPPORT', isAvailable: true, id: { not: itSupportId } }, select: { id: true } })
    await prisma.user.updateMany({ where: { id: { in: others.map((o) => o.id) } }, data: { isAvailable: false } })
    await prisma.user.update({ where: { id: itSupportId }, data: { skills: JSON.stringify(['Email']), isAvailable: true } })
    try {
      await prisma.appSettings.update({ where: { id: 'singleton' }, data: { autoAssignmentEnabled: true } })
      signInAs(employeeId, 'EMPLOYEE')
      await expect(
        createTicket(undefined, form({ title: 'Outlook will not send', description: 'Emails stay in the outbox.', category: 'Email & Communication' }))
      ).rejects.toThrow('NEXT_REDIRECT')
      const ticket = await prisma.ticket.findFirst({ where: { createdById: employeeId, title: 'Outlook will not send' } })
      expect(ticket?.assignedToId).toBe(itSupportId)
    } finally {
      await prisma.user.updateMany({ where: { id: { in: others.map((o) => o.id) } }, data: { isAvailable: true } })
      await prisma.user.update({ where: { id: itSupportId }, data: { skills: '[]' } })
      if (setting) await prisma.appSettings.update({ where: { id: 'singleton' }, data: setting })
    }
  })

  it('redirects signed-out users to the login page', async () => {
    signedOut()
    await expect(
      createTicket(undefined, form({ title: 'Printer offline', description: 'The 2nd floor printer is offline.', category: 'Printer' }))
    ).rejects.toThrow('NEXT_REDIRECT /login')
  })
})

// ────────────────────────────────────────────────────────
// TEST 3: Role Authorization — real actions refuse the wrong role
// ────────────────────────────────────────────────────────
describe('Test 3: Role Authorization', () => {
  let ticketId: string

  beforeAll(async () => {
    ticketId = await createTestTicket(employeeId)
  })

  it('EMPLOYEE cannot change ticket status', async () => {
    signInAs(employeeId, 'EMPLOYEE')
    const result = await updateTicketStatus(ticketId, 'ASSIGNED')
    expect(result.error).toMatch(/Only IT Support/)
    expect(await statusOf(ticketId)).toBe('OPEN')
  })

  it('EMPLOYEE cannot assign or take over tickets', async () => {
    signInAs(employeeId, 'EMPLOYEE')
    expect((await assignTicket(ticketId, itSupportId)).error).toMatch(/Unauthorized/)
    expect((await takeOverTicket(ticketId)).error).toMatch(/Unauthorized/)
    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } })
    expect(ticket?.assignedToId).toBeNull()
  })

  it('EMPLOYEE cannot promote themselves to ADMIN', async () => {
    signInAs(employeeId, 'EMPLOYEE')
    await expect(updateUserRole(employeeId, 'ADMIN')).rejects.toThrow('NEXT_REDIRECT /tickets')
    const user = await prisma.user.findUnique({ where: { id: employeeId } })
    expect(user?.role).toBe('EMPLOYEE')
  })

  it('IT_SUPPORT cannot use admin-only actions', async () => {
    signInAs(itSupportId, 'IT_SUPPORT')
    expect((await reassignTicket(ticketId, itPeerId)).error).toMatch(/Only Admins/)
    await expect(updateUserStatus(employeeId, 'SUSPENDED')).rejects.toThrow('NEXT_REDIRECT /tickets')
    const user = await prisma.user.findUnique({ where: { id: employeeId } })
    expect(user?.accountStatus).toBe('APPROVED')
  })

  it('admins can only give agents skills that are real categories', async () => {
    signInAs(adminId, 'ADMIN')
    expect(await updateUserRole(itPeerId, 'IT_SUPPORT', ['Email', 'Hacking', 'Printer'])).toEqual({})
    const peer = await prisma.user.findUnique({ where: { id: itPeerId } })
    expect(JSON.parse(peer!.skills)).toEqual(['Email & Communication', 'Printer'])
    await prisma.user.update({ where: { id: itPeerId }, data: { skills: '[]' } })
  })

  it("IT_SUPPORT cannot change the status of another agent's ticket", async () => {
    const peerTicketId = await createTestTicket(employeeId, { status: 'ASSIGNED', assignedToId: itPeerId })
    signInAs(itSupportId, 'IT_SUPPORT')
    const result = await updateTicketStatus(peerTicketId, 'IN_PROGRESS')
    expect(result.error).toMatch(/Read Only/)
    expect(await statusOf(peerTicketId)).toBe('ASSIGNED')
  })
})

// ────────────────────────────────────────────────────────
// TEST 4: Status Lifecycle — the real updateTicketStatus state machine
// ────────────────────────────────────────────────────────
describe('Test 4: Status Lifecycle State Machine', () => {
  let ticketId: string

  beforeAll(async () => {
    ticketId = await createTestTicket(employeeId)
  })

  const moveTo = (status: 'OPEN' | 'ASSIGNED' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED') => {
    signInAs(itSupportId, 'IT_SUPPORT')
    return updateTicketStatus(ticketId, status)
  }

  it.each(['IN_PROGRESS', 'RESOLVED', 'CLOSED'] as const)('rejects skipping from OPEN to %s', async (to) => {
    expect((await moveTo(to)).error).toMatch(/Invalid status transition: OPEN/)
    expect(await statusOf(ticketId)).toBe('OPEN')
  })

  it('OPEN → ASSIGNED claims the unassigned ticket for the agent', async () => {
    expect(await moveTo('ASSIGNED')).toEqual({})
    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } })
    expect(ticket?.status).toBe('ASSIGNED')
    expect(ticket?.assignedToId).toBe(itSupportId)
  })

  it('ASSIGNED → IN_PROGRESS → RESOLVED', async () => {
    expect(await moveTo('IN_PROGRESS')).toEqual({})
    expect(await moveTo('RESOLVED')).toEqual({})
    expect(await statusOf(ticketId)).toBe('RESOLVED')
  })

  it('rejects going backwards from RESOLVED', async () => {
    expect((await moveTo('OPEN')).error).toMatch(/Invalid status transition: RESOLVED/)
    expect((await moveTo('IN_PROGRESS')).error).toMatch(/Invalid status transition: RESOLVED/)
    expect(await statusOf(ticketId)).toBe('RESOLVED')
  })

  it('RESOLVED → CLOSED, after which every transition is rejected', async () => {
    expect(await moveTo('CLOSED')).toEqual({})
    for (const to of ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED'] as const) {
      expect((await moveTo(to)).error).toMatch(/terminal state/)
    }
    expect(await statusOf(ticketId)).toBe('CLOSED')
  })

  it('records each successful transition in the audit trail, and nothing for rejected ones', async () => {
    const history = await prisma.ticketHistory.findMany({ where: { ticketId }, select: { action: true, userId: true, event: true } })
    expect(history.map((h) => h.action).sort()).toEqual(
      [
        'Ticket claimed and status changed from OPEN to ASSIGNED',
        'Ticket status changed from ASSIGNED to IN_PROGRESS',
        'Ticket status changed from IN_PROGRESS to RESOLVED',
        'Ticket status changed from RESOLVED to CLOSED',
      ].sort()
    )
    expect(history.every((h) => h.userId === itSupportId)).toBe(true)
    // Stored as structured events too, so the timeline can be translated
    expect(history.every((h) => h.event === 'status_changed')).toBe(true)
  })
})

// ────────────────────────────────────────────────────────
// TEST 5: Data Isolation — real pages and actions
// ────────────────────────────────────────────────────────
describe('Test 5: Data Isolation', () => {
  let otherEmployeeId: string
  let otherTicketId: string
  let ownTicketId: string

  type ListProps = { tickets: { id: string; createdById: string }[] }

  beforeAll(async () => {
    otherEmployeeId = await createUser('Other Employee', `other-employee-${stamp}@test.com`, 'EMPLOYEE')
    otherTicketId = await createTestTicket(otherEmployeeId)
    ownTicketId = await createTestTicket(employeeId)
    await prisma.comment.createMany({
      data: [
        { ticketId: ownTicketId, authorId: itSupportId, content: 'Public reply', isInternal: false },
        { ticketId: ownTicketId, authorId: itSupportId, content: 'Internal note', isInternal: true },
      ],
    })
  })

  it('ticket list page shows an EMPLOYEE only their own tickets', async () => {
    signInAs(employeeId, 'EMPLOYEE')
    const page = (await TicketsPage({ searchParams: Promise.resolve({}) })) as ReactElement<ListProps>
    const ids = page.props.tickets.map((t) => t.id)
    expect(ids).toContain(ownTicketId)
    expect(ids).not.toContain(otherTicketId)
    expect(page.props.tickets.every((t) => t.createdById === employeeId)).toBe(true)
  })

  it('ticket list page shows IT_SUPPORT every ticket in the "all" queue', async () => {
    signInAs(itSupportId, 'IT_SUPPORT')
    const page = (await TicketsPage({ searchParams: Promise.resolve({ queue: 'all' }) })) as ReactElement<ListProps>
    const ids = page.props.tickets.map((t) => t.id)
    expect(ids).toContain(ownTicketId)
    expect(ids).toContain(otherTicketId)
  })

  it("ticket detail page returns 404 for another employee's ticket", async () => {
    signInAs(employeeId, 'EMPLOYEE')
    await expect(TicketDetailPage({ params: Promise.resolve({ id: otherTicketId }) })).rejects.toThrow('NEXT_NOT_FOUND')
  })

  it('getTicketDetails returns null when an EMPLOYEE requests another user ticket', async () => {
    signInAs(employeeId, 'EMPLOYEE')
    expect(await getTicketDetails(otherTicketId)).toBeNull()
  })

  it('getTicketDetails returns the ticket to its EMPLOYEE owner without internal notes', async () => {
    signInAs(employeeId, 'EMPLOYEE')
    const ticket = await getTicketDetails(ownTicketId)
    expect(ticket?.id).toBe(ownTicketId)
    expect(ticket?.comments.map((c) => c.content)).toEqual(['Public reply'])
  })

  it('getTicketDetails returns any ticket, with internal notes, to IT_SUPPORT', async () => {
    signInAs(itSupportId, 'IT_SUPPORT')
    expect((await getTicketDetails(otherTicketId))?.id).toBe(otherTicketId)
    const own = await getTicketDetails(ownTicketId)
    expect(own?.comments.map((c) => c.content).sort()).toEqual(['Internal note', 'Public reply'])
  })

  it("EMPLOYEE cannot comment on another employee's ticket", async () => {
    signInAs(employeeId, 'EMPLOYEE', 'Test Employee')
    const result = await addComment(otherTicketId, 'Let me in')
    expect(result.error).toMatch(/Forbidden/)
    expect(await prisma.comment.count({ where: { ticketId: otherTicketId } })).toBe(0)
  })

  it('EMPLOYEE comments are always public, even if they ask for an internal note', async () => {
    signInAs(employeeId, 'EMPLOYEE', 'Test Employee')
    expect(await addComment(ownTicketId, 'Still broken', true)).toEqual({})
    const comment = await prisma.comment.findFirst({ where: { ticketId: ownTicketId, authorId: employeeId } })
    expect(comment?.isInternal).toBe(false)
  })
})

// ────────────────────────────────────────────────────────
// TEST 6: API Authentication & Upload Safety
// ────────────────────────────────────────────────────────
describe('Test 6: API Authentication & Upload Safety', () => {
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

  it('translateAction rejects unauthenticated callers without calling Gemini', async () => {
    signedOut()
    vi.mocked(translateText).mockClear()
    const result = await translateAction({ text: 'hello', targetLanguage: 'Arabic' })
    expect(result.success).toBe(false)
    expect(translateText).not.toHaveBeenCalled()
  })
})

// ────────────────────────────────────────────────────────
// TEST 7: AI Features — honest results, admin settings respected
// ────────────────────────────────────────────────────────
describe('Test 7: AI Features', () => {
  type SettingsBackup = { enableAiTriage: boolean; fallbackHeuristicsEnabled: boolean } | null
  let backup: SettingsBackup = null
  let ticketId: string

  const triageRequest = (body: unknown) =>
    new NextRequest('http://localhost/api/ai/triage', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json' },
    })

  const setAiSettings = (data: { enableAiTriage?: boolean; fallbackHeuristicsEnabled?: boolean }) =>
    prisma.appSettings.upsert({ where: { id: 'singleton' }, create: { id: 'singleton', ...data }, update: data })

  beforeAll(async () => {
    backup = await prisma.appSettings.findUnique({
      where: { id: 'singleton' },
      select: { enableAiTriage: true, fallbackHeuristicsEnabled: true },
    })
    ticketId = await createTestTicket(employeeId)
  })

  afterAll(async () => {
    if (backup) await prisma.appSettings.update({ where: { id: 'singleton' }, data: backup })
    vi.mocked(isAiConfigured).mockReturnValue(true)
  })

  it('triage returns the Gemini answer labelled as AI', async () => {
    await setAiSettings({ enableAiTriage: true, fallbackHeuristicsEnabled: true })
    signInAs(employeeId, 'EMPLOYEE')
    vi.mocked(triageTicket).mockResolvedValueOnce({
      category: 'Network',
      priority: 'HIGH',
      selfHelp: ['Reconnect the VPN'],
      reason: 'VPN issue',
    })
    const res = await triagePOST(triageRequest({ title: 'VPN drops', description: 'every 10 minutes', locale: 'ar' }))
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ source: 'ai', category: 'Network', priority: 'HIGH' })
    expect(vi.mocked(triageTicket).mock.lastCall?.[3]).toBe('ar')
  })

  it('triage falls back to keyword rules, labelled as rules, when Gemini fails', async () => {
    signInAs(employeeId, 'EMPLOYEE')
    vi.mocked(triageTicket).mockRejectedValueOnce(new Error('quota exceeded'))
    const res = await triagePOST(triageRequest({ title: 'Printer jammed', description: 'paper stuck' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.source).toBe('rules')
    expect(body.category).toBe('Printer')
    expect(body).not.toHaveProperty('matchScore')
  })

  it('triage returns 503 instead of guessing when the admin disabled the fallback', async () => {
    await setAiSettings({ fallbackHeuristicsEnabled: false })
    signInAs(employeeId, 'EMPLOYEE')
    vi.mocked(isAiConfigured).mockReturnValueOnce(false)
    const res = await triagePOST(triageRequest({ title: 'Printer jammed', description: 'paper stuck' }))
    expect(res.status).toBe(503)
  })

  it('triage is refused when the admin turned AI triage off', async () => {
    await setAiSettings({ enableAiTriage: false, fallbackHeuristicsEnabled: true })
    signInAs(employeeId, 'EMPLOYEE')
    vi.mocked(triageTicket).mockClear()
    const res = await triagePOST(triageRequest({ title: 'Printer jammed', description: 'paper stuck' }))
    expect(res.status).toBe(403)
    expect(triageTicket).not.toHaveBeenCalled()
    await setAiSettings({ enableAiTriage: true })
  })

  it('ticket summaries are only available to IT support and admins', async () => {
    const summarize = (id: string) =>
      summarizePOST(new NextRequest(`http://localhost/api/ai/summarize/${id}?locale=ar`, { method: 'POST' }), {
        params: Promise.resolve({ id }),
      })

    signInAs(employeeId, 'EMPLOYEE')
    expect((await summarize(ticketId)).status).toBe(403)

    vi.mocked(summarizeTicket).mockResolvedValueOnce({ summary: 'S', nextAction: 'N' })
    signInAs(itSupportId, 'IT_SUPPORT')
    const res = await summarize(ticketId)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ summary: 'S', nextAction: 'N' })
    expect(vi.mocked(summarizeTicket).mock.lastCall?.[2]).toBe('ar')
  })

  it('translation reports an honest error instead of inventing text', async () => {
    signInAs(employeeId, 'EMPLOYEE')
    vi.mocked(translateText).mockRejectedValueOnce(new AiNotConfiguredError())
    expect(await translateAction({ text: 'hello', targetLanguage: 'Arabic' })).toEqual({ success: false, error: 'not_configured' })

    vi.mocked(translateText).mockRejectedValueOnce(new Error('network'))
    expect(await translateAction({ text: 'hello', targetLanguage: 'Arabic' })).toEqual({ success: false, error: 'failed' })

    vi.mocked(translateText).mockResolvedValueOnce('مرحبا')
    expect(await translateAction({ text: 'hello', targetLanguage: 'Arabic' })).toEqual({ success: true, translation: 'مرحبا' })
  })
})

// ────────────────────────────────────────────────────────
// TEST 8: SLA Tracking — resolution times, breaches, admin filters
// ────────────────────────────────────────────────────────
describe('Test 8: SLA Tracking', () => {
  const hoursFromNow = (h: number) => new Date(Date.now() + h * 3_600_000)
  const resolve = async (ticketId: string) => {
    signInAs(itSupportId, 'IT_SUPPORT')
    for (const to of ['ASSIGNED', 'IN_PROGRESS', 'RESOLVED'] as const) {
      expect(await updateTicketStatus(ticketId, to)).toEqual({})
    }
    return prisma.ticket.findUniqueOrThrow({ where: { id: ticketId } })
  }

  it('records when a ticket was resolved and that it met its SLA', async () => {
    const id = await createTestTicket(employeeId, { slaDeadline: hoursFromNow(24) })
    const ticket = await resolve(id)
    expect(ticket.resolvedAt).not.toBeNull()
    expect(ticket.slaBreached).toBe(false)
  })

  it('flags a ticket resolved after its deadline as an SLA breach', async () => {
    const id = await createTestTicket(employeeId, { slaDeadline: hoursFromNow(-2) })
    expect((await resolve(id)).slaBreached).toBe(true)
  })

  it('records the close time, and reopening clears both times but keeps the breach', async () => {
    const id = await createTestTicket(employeeId, { slaDeadline: hoursFromNow(-2) })
    await resolve(id)
    signInAs(employeeId, 'EMPLOYEE')
    expect(await confirmTicketResolution(id)).toEqual({})
    const closed = await prisma.ticket.findUniqueOrThrow({ where: { id } })
    expect(closed.closedAt).not.toBeNull()

    expect(await reopenTicket(id, 'It broke again this morning')).toEqual({})
    const reopened = await prisma.ticket.findUniqueOrThrow({ where: { id } })
    expect(reopened).toMatchObject({ resolvedAt: null, closedAt: null, slaBreached: true })
  })

  it('the admin "SLA breaches" view lists overdue and late-resolved tickets only', async () => {
    const overdue = await createTestTicket(employeeId, { slaDeadline: hoursFromNow(-1) })
    const onTrack = await createTestTicket(employeeId, { slaDeadline: hoursFromNow(5) })
    const resolvedLate = await createTestTicket(employeeId, { status: 'RESOLVED', slaDeadline: hoursFromNow(-9), slaBreached: true })
    const resolvedOnTime = await createTestTicket(employeeId, { status: 'RESOLVED', slaDeadline: hoursFromNow(-9) })

    signInAs(adminId, 'ADMIN')
    type Props = { tickets: { id: string }[]; slaBreachedOnly: boolean }
    const page = (await AdminTicketsPage({ searchParams: Promise.resolve({ filter: 'sla_breached' }) })) as ReactElement<Props>
    const ids = page.props.tickets.map((t) => t.id)
    expect(page.props.slaBreachedOnly).toBe(true)
    expect(ids).toEqual(expect.arrayContaining([overdue, resolvedLate]))
    expect(ids).not.toContain(onTrack)
    expect(ids).not.toContain(resolvedOnTime)

    const all = (await AdminTicketsPage({ searchParams: Promise.resolve({}) })) as ReactElement<Props>
    expect(all.props.tickets.map((t) => t.id)).toContain(onTrack)
  })

  it('the "pending requests" link opens the users page filtered to pending accounts', async () => {
    signInAs(adminId, 'ADMIN')
    type Props = { initialStatus: string }
    const pending = (await AdminUsersPage({ searchParams: Promise.resolve({ status: 'PENDING' }) })) as ReactElement<Props>
    expect(pending.props.initialStatus).toBe('PENDING')
    const junk = (await AdminUsersPage({ searchParams: Promise.resolve({ status: 'HACKED' }) })) as ReactElement<Props>
    expect(junk.props.initialStatus).toBe('')
  })
})

// ────────────────────────────────────────────────────────
// TEST 9: Admin Settings — validated on the server
// ────────────────────────────────────────────────────────
describe('Test 9: Admin Settings', () => {
  let original: Awaited<ReturnType<typeof prisma.appSettings.findUnique>>
  const valid: SettingsInput = {
    appName: 'Acme IT Desk',
    supportEmail: 'it@acme.test',
    defaultPriority: 'MEDIUM',
    autoAssignmentEnabled: true,
    slaCriticalHours: 4,
    slaHighHours: 24,
    slaMediumHours: 48,
    slaLowHours: 72,
    businessHoursStart: '09:00',
    businessHoursEnd: '17:00',
    workDays: JSON.stringify(['Sunday', 'Monday']),
    pauseSlaOnWeekends: true,
    enableAiTriage: true,
    fallbackHeuristicsEnabled: true,
    autoApproveDomain: '@acme.test',
    maintenanceMode: false,
    categoriesList: JSON.stringify(['Hardware', 'Other']),
    cannedResponses: '[]',
  }

  beforeAll(async () => {
    original = await prisma.appSettings.findUnique({ where: { id: 'singleton' } })
  })
  afterAll(async () => {
    if (original) {
      const { id, updatedAt, ...data } = original
      await prisma.appSettings.update({ where: { id: 'singleton' }, data })
    }
  })

  it('only admins can change settings', async () => {
    signInAs(itSupportId, 'IT_SUPPORT')
    expect(await updateSettings(valid)).toEqual({ error: 'Unauthorized' })
  })

  it.each([
    ['an unknown priority', { defaultPriority: 'URGENT' }],
    ['negative SLA hours', { slaHighHours: -5 }],
    ['fractional SLA hours', { slaLowHours: 1.5 }],
    ['a malformed time', { businessHoursStart: '9am' }],
    ['hours that end before they start', { businessHoursStart: '18:00' }],
    ['an invalid work day', { workDays: JSON.stringify(['Funday']) }],
    ['no categories', { categoriesList: '[]' }],
    ['a bad email', { supportEmail: 'not-an-email' }],
  ] as const)('rejects %s', async (_label, change) => {
    signInAs(adminId, 'ADMIN')
    const result = await updateSettings({ ...valid, ...change })
    expect(result.error).toBeTruthy()
  })

  it('saves valid settings', async () => {
    signInAs(adminId, 'ADMIN')
    expect(await updateSettings(valid)).toEqual({})
    const saved = await prisma.appSettings.findUnique({ where: { id: 'singleton' } })
    expect(saved).toMatchObject({ appName: 'Acme IT Desk', supportEmail: 'it@acme.test', slaHighHours: 24 })
  })
})

// ────────────────────────────────────────────────────────
// TEST 10: Invites & Passwords — temporary password, forced change
// ────────────────────────────────────────────────────────
describe('Test 10: Invites & Passwords', () => {
  const invitedEmail = `test-invited-${stamp}@test.com`
  let invitedId: string
  let tempPassword: string

  const passwordForm = (current: string, next: string, confirm = next) =>
    form({ currentPassword: current, newPassword: next, confirmPassword: confirm })

  it('only admins can invite users', async () => {
    signInAs(itSupportId, 'IT_SUPPORT')
    await expect(inviteUser({ name: 'Nope', email: 'nope@test.com', role: 'ADMIN' })).rejects.toThrow('NEXT_REDIRECT /tickets')
  })

  it('an invite creates an INVITED account and returns a one-time password', async () => {
    signInAs(adminId, 'ADMIN')
    const result = await inviteUser({ name: 'New Starter', email: invitedEmail.toUpperCase(), role: 'EMPLOYEE' })
    expect(result.error).toBeUndefined()
    expect(result.tempPassword).toMatch(/^[A-Za-z0-9]{4}-[A-Za-z0-9]{4}-[A-Za-z0-9]{4}$/)
    tempPassword = result.tempPassword!

    const user = await prisma.user.findUniqueOrThrow({ where: { email: invitedEmail } })
    invitedId = user.id
    testUserIds.push(user.id)
    expect(user).toMatchObject({ name: 'New Starter', role: 'EMPLOYEE', accountStatus: 'INVITED' })
    expect(await bcrypt.compare(tempPassword, user.password)).toBe(true)

    expect((await inviteUser({ name: 'Again', email: invitedEmail, role: 'EMPLOYEE' })).error).toMatch(/already exists/)
  })

  it('signing in with the temporary password forces a password change', async () => {
    vi.mocked(createSession).mockClear()
    await expect(login(undefined, form({ email: invitedEmail, password: tempPassword }))).rejects.toThrow(
      'NEXT_REDIRECT /account/password'
    )
    expect(vi.mocked(createSession).mock.lastCall?.[0]).toMatchObject({ userId: invitedId, mustChangePassword: true })
  })

  it('the proxy keeps a user with a temporary password on the password page', async () => {
    vi.mocked(decrypt).mockResolvedValue({ userId: invitedId, role: 'EMPLOYEE', mustChangePassword: true } as SessionPayload)
    const location = async (path: string) => (await proxy(new NextRequest(`http://localhost${path}`))).headers.get('location')
    expect(await location('/tickets')).toBe('http://localhost/account/password')
    expect(await location('/tickets/new')).toBe('http://localhost/account/password')
    expect(await location('/account/password')).toBeNull()

    vi.mocked(decrypt).mockResolvedValue({ userId: employeeId, role: 'EMPLOYEE' } as SessionPayload)
    expect(await location('/tickets')).toBeNull()
    expect(await location('/admin/users')).toBe('http://localhost/tickets')

    vi.mocked(decrypt).mockResolvedValue(null)
    expect(await location('/account/password')).toBe('http://localhost/login')
  })

  it.each([
    ['the current password is wrong', ['wrong-one', 'brand-new-pass'], 'wrong_current'],
    ['the new password is too short', [null, 'short'], 'too_short'],
    ['the confirmation does not match', [null, 'brand-new-pass', 'brand-new-pazz'], 'mismatch'],
    ['the new password equals the old one', [null, null], 'same_as_current'],
  ] as const)('rejects the change when %s', async (_label, [current, next, confirm], error) => {
    signInAs(invitedId, 'EMPLOYEE', 'New Starter', { mustChangePassword: true })
    const result = await changePassword(undefined, passwordForm(current ?? tempPassword, next ?? tempPassword, confirm ?? next ?? tempPassword))
    expect(result).toEqual({ error })
  })

  it('setting a password activates the account and continues into the app', async () => {
    signInAs(invitedId, 'EMPLOYEE', 'New Starter', { mustChangePassword: true })
    vi.mocked(createSession).mockClear()
    await expect(changePassword(undefined, passwordForm(tempPassword, 'my-own-password'))).rejects.toThrow('NEXT_REDIRECT /tickets')
    expect(vi.mocked(createSession).mock.lastCall?.[0]).not.toHaveProperty('mustChangePassword')

    const user = await prisma.user.findUniqueOrThrow({ where: { id: invitedId } })
    expect(user.accountStatus).toBe('APPROVED')
    await expect(login(undefined, form({ email: invitedEmail, password: 'my-own-password' }))).rejects.toThrow(/^NEXT_REDIRECT \/tickets$/)
  })

  it('any user can change their password later without being redirected', async () => {
    signInAs(invitedId, 'EMPLOYEE', 'New Starter')
    expect(await changePassword(undefined, passwordForm('my-own-password', 'another-password'))).toEqual({ success: true })
  })
})
