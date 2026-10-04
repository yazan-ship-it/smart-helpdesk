/**
 * Smart IT Helpdesk — Test Suite
 *
 * Every test calls the real server actions, pages and route handlers against the
 * database. Only the Next.js request context (session cookie, redirect, notFound,
 * revalidatePath) and the Gemini client are stubbed.
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
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
// The client address used for rate limiting (a documentation-only IP range)
vi.mock('next/headers', () => ({
  headers: vi.fn(async () => new Headers({ 'x-forwarded-for': '203.0.113.1' })),
}))
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

import { rm } from 'fs/promises'
import os from 'os'
import path from 'path'
import type { ReactElement } from 'react'
import { NextRequest } from 'next/server'
import { headers } from 'next/headers'
import { getSession, createSession, decrypt, type Role, type SessionPayload } from '@/lib/session'
import { createPrismaClient } from '@/lib/db'
import { AiNotConfiguredError, isAiConfigured, summarizeTicket, triageTicket, translateText } from '@/lib/gemini'
import { login, register } from '@/app/actions/auth'
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
  submitCsatRating,
} from '@/app/actions/tickets'
import { inviteUser, updateUserRole, updateUserStatus } from '@/app/actions/admin'
import { changePassword } from '@/app/actions/account'
import proxy from '@/proxy'
import { checkSession } from '@/lib/session-check'
import { getDemoAccounts } from '@/lib/demo'
import { parseCannedResponses } from '@/lib/settings'
import { translateAction } from '@/app/actions/translate'
import { updateSettings, type SettingsInput } from '@/app/actions/settings'
import TicketsPage from '@/app/tickets/page'
import TicketDetailPage from '@/app/tickets/[id]/page'
import AdminTicketsPage from '@/app/admin/tickets/page'
import AdminUsersPage from '@/app/admin/users/page'
import { POST as uploadPOST } from '@/app/api/upload/route'
import { GET as fileGET, DELETE as fileDELETE } from '@/app/api/files/[id]/route'
import * as authActions from '@/app/actions/auth'
import { POST as triagePOST } from '@/app/api/ai/triage/route'
import { POST as summarizePOST } from '@/app/api/ai/summarize/[id]/route'

const prisma = createPrismaClient()
const storageDir = path.join(os.tmpdir(), `helpdesk-test-uploads-${process.pid}`)
process.env.STORAGE_DIR = storageDir
delete process.env.BLOB_READ_WRITE_TOKEN

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

function uploadRequest(...files: File[]) {
  const formData = new FormData()
  files.forEach((f) => formData.append('files', f))
  return new NextRequest('http://localhost/api/upload', { method: 'POST', body: formData })
}

/** Uploads a small PNG as the signed-in user and returns its attachment id */
async function uploadPng(name = 'shot.png') {
  const res = await uploadPOST(uploadRequest(new File(['png-bytes'], name, { type: 'image/png' })))
  expect(res.status).toBe(200)
  return (await res.json()).attachments[0].id as string
}

function form(fields: Record<string, string>) {
  const fd = new FormData()
  for (const [k, v] of Object.entries(fields)) fd.set(k, v)
  return fd
}

// ─── Setup & Teardown ─────────────────────────────────
const clearTestRateLimits = () =>
  prisma.rateLimit.deleteMany({
    where: { OR: [{ key: { contains: String(stamp) } }, { key: { startsWith: 'login:address:203.0.113.' } }, { key: { startsWith: 'register:address:203.0.113.' } }, { key: { contains: 'unknown-' } }, { key: { in: testUserIds.flatMap((id) => [`ai:user:${id}`, `upload:user:${id}`]) } }] },
  })

beforeAll(async () => {
  await clearTestRateLimits()
  employeeId = await createUser('Test Employee', employeeEmail, 'EMPLOYEE')
  itSupportId = await createUser('Test IT Support', itSupportEmail, 'IT_SUPPORT')
  itPeerId = await createUser('Test IT Peer', `test-it-peer-${stamp}@test.com`, 'IT_SUPPORT')
  adminId = await createUser('Test Admin', `test-admin-${stamp}@test.com`, 'ADMIN')
  await createUser('Test Pending', pendingEmail, 'EMPLOYEE', 'PENDING')
})

afterAll(async () => {
  await clearTestRateLimits()
  await rm(storageDir, { recursive: true, force: true })
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
      { userId: employeeId, role: 'EMPLOYEE', name: 'Test Employee', email: employeeEmail, mustChangePassword: false, sessionVersion: 0 },
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
    expect(result).toEqual({ error: 'unauthorized' })
    expect(await statusOf(ticketId)).toBe('OPEN')
  })

  it('EMPLOYEE cannot assign or take over tickets', async () => {
    signInAs(employeeId, 'EMPLOYEE')
    expect(await assignTicket(ticketId, itSupportId)).toEqual({ error: 'unauthorized' })
    expect(await takeOverTicket(ticketId)).toEqual({ error: 'unauthorized' })
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
    expect(await reassignTicket(ticketId, itPeerId)).toEqual({ error: 'unauthorized' })
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
    expect(result).toEqual({ error: 'assigned_to_other', params: { name: 'Test IT Peer' } })
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
    expect(await moveTo(to)).toEqual({ error: 'invalid_transition' })
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
    expect(await moveTo('OPEN')).toEqual({ error: 'invalid_transition' })
    expect(await moveTo('IN_PROGRESS')).toEqual({ error: 'invalid_transition' })
    expect(await statusOf(ticketId)).toBe('RESOLVED')
  })

  it('RESOLVED → CLOSED, after which every transition is rejected', async () => {
    expect(await moveTo('CLOSED')).toEqual({})
    for (const to of ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED'] as const) {
      expect(await moveTo(to)).toEqual({ error: 'invalid_transition' })
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
    expect(result).toEqual({ error: 'forbidden' })
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

  it('upload rejects files larger than 4 MB (the hosting limit per request)', async () => {
    signInAs(employeeId, 'EMPLOYEE')
    const big = new File([new Uint8Array(4 * 1024 * 1024 + 1)], 'big.pdf', { type: 'application/pdf' })
    const res = await uploadPOST(uploadRequest(big))
    expect(res.status).toBe(413)
  })

  it('upload rejects more than 5 files at once', async () => {
    signInAs(employeeId, 'EMPLOYEE')
    const files = Array.from({ length: 6 }, (_, i) => new File(['x'], `f${i}.txt`, { type: 'text/plain' }))
    const res = await uploadPOST(uploadRequest(...files))
    expect(res.status).toBe(400)
  })

  it('upload stores an allowed file privately, under a random name, with the server-side type', async () => {
    signInAs(employeeId, 'EMPLOYEE')
    const res = await uploadPOST(uploadRequest(new File(['png-bytes'], 'Screen Shot.PNG', { type: 'text/html' })))
    expect(res.status).toBe(200)
    const { attachments } = await res.json()
    expect(attachments).toHaveLength(1)
    expect(attachments[0]).toMatchObject({ name: 'Screen Shot.PNG', type: 'image/png' }) // not the client-claimed text/html
    expect(attachments[0].url).toBe(`/api/files/${attachments[0].id}`)

    const row = await prisma.attachment.findUniqueOrThrow({ where: { id: attachments[0].id } })
    expect(row).toMatchObject({ uploadedById: employeeId, ticketId: null })
    expect(row.storageKey).toMatch(/^[0-9a-f-]{36}\.png$/)
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
    expect(await updateSettings(valid)).toEqual({ error: 'unauthorized' })
  })

  it.each([
    ['an unknown priority', { defaultPriority: 'URGENT' }, 'settings_default_priority'],
    ['negative SLA hours', { slaHighHours: -5 }, 'settings_sla_hours'],
    ['fractional SLA hours', { slaLowHours: 1.5 }, 'settings_sla_hours'],
    ['a malformed time', { businessHoursStart: '9am' }, 'settings_time_format'],
    ['hours that end before they start', { businessHoursStart: '18:00' }, 'settings_hours_order'],
    ['an invalid work day', { workDays: JSON.stringify(['Funday']) }, 'settings_work_days'],
    ['no categories', { categoriesList: '[]' }, 'settings_categories'],
    ['a bad email', { supportEmail: 'not-an-email' }, 'settings_support_email'],
    ['a domain without @', { autoApproveDomain: 'company.com' }, 'settings_domain'],
  ] as const)('rejects %s', async (_label, change, error) => {
    signInAs(adminId, 'ADMIN')
    expect(await updateSettings({ ...valid, ...change })).toEqual({ error })
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

    expect(await inviteUser({ name: 'Again', email: invitedEmail, role: 'EMPLOYEE' })).toEqual({ error: 'email_taken' })
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

// ────────────────────────────────────────────────────────
// TEST 11: Sessions — a signed cookie is re-checked against the database
// ────────────────────────────────────────────────────────
describe('Test 11: Sessions', () => {
  let userId: string
  const token = (extra: Partial<SessionPayload> = {}) =>
    ({ userId, role: 'EMPLOYEE', name: 'Session User', email: 'x', sessionVersion: 0, ...extra }) as SessionPayload
  const visit = async (path: string, payload: SessionPayload | null) => {
    vi.mocked(decrypt).mockResolvedValue(payload)
    return proxy(new NextRequest(`http://localhost${path}`, { headers: { cookie: 'helpdesk-session=signed' } }))
  }
  const setUser = (data: { role?: string; accountStatus?: string }) => prisma.user.update({ where: { id: userId }, data })

  beforeAll(async () => {
    userId = await createUser('Session User', `test-session-${stamp}@test.com`, 'EMPLOYEE')
  })

  it('an active user keeps their session, with role and name read from the database', async () => {
    await setUser({ role: 'IT_SUPPORT' })
    const check = await checkSession(token({ role: 'ADMIN', name: 'Old Name' }))
    expect(check).toMatchObject({ session: { userId, role: 'IT_SUPPORT', name: 'Session User', mustChangePassword: false } })
    await setUser({ role: 'EMPLOYEE' })
  })

  it('a role taken away ends admin access on the next request', async () => {
    const res = await visit('/admin/users', token({ role: 'ADMIN' }))
    expect(res.headers.get('location')).toBe('http://localhost/tickets')
  })

  it.each([
    ['SUSPENDED', 'suspended'],
    ['REJECTED', 'rejected'],
    ['PENDING', 'pending'],
  ])('a %s account is signed out and told why', async (status, reason) => {
    await setUser({ accountStatus: status })
    try {
      expect(await checkSession(token())).toEqual({ ended: reason })
      const res = await visit('/tickets', token())
      expect(res.headers.get('location')).toBe(`http://localhost/login?reason=${reason}`)
      expect(res.headers.get('set-cookie')).toMatch(/helpdesk-session=;.*Expires=Thu, 01 Jan 1970/i)
    } finally {
      await setUser({ accountStatus: 'APPROVED' })
    }
  })

  it('a deleted account is signed out', async () => {
    expect(await checkSession(token({ userId: 'no-such-user' }))).toEqual({ ended: 'session_ended' })
  })

  it('on the login page an ended session is cleared without a redirect loop', async () => {
    await setUser({ accountStatus: 'SUSPENDED' })
    try {
      const res = await visit('/login', token())
      expect(res.headers.get('location')).toBeNull()
      expect(res.headers.get('set-cookie')).toMatch(/helpdesk-session=;/)
    } finally {
      await setUser({ accountStatus: 'APPROVED' })
    }
  })

  it('changing the password signs out other devices but keeps this one', async () => {
    const before = token()
    signInAs(userId, 'EMPLOYEE', 'Session User', { sessionVersion: 0 })
    vi.mocked(createSession).mockClear()
    expect(await changePassword(undefined, form({ currentPassword: PASSWORD, newPassword: 'a-new-password', confirmPassword: 'a-new-password' }))).toEqual({ success: true })

    expect(await checkSession(before)).toEqual({ ended: 'session_ended' })
    const reissued = vi.mocked(createSession).mock.lastCall?.[0]
    expect(reissued?.sessionVersion).toBe(1)
    expect(await checkSession(token({ sessionVersion: 1 }))).toHaveProperty('session')
  })

  it('maintenance mode ends the sessions of everyone but admins', async () => {
    const setting = await prisma.appSettings.findUnique({ where: { id: 'singleton' }, select: { maintenanceMode: true } })
    try {
      await prisma.appSettings.update({ where: { id: 'singleton' }, data: { maintenanceMode: true } })
      expect(await checkSession(token({ sessionVersion: 1 }))).toEqual({ ended: 'maintenance' })
      expect(await checkSession({ ...token(), userId: adminId })).toHaveProperty('session')
    } finally {
      if (setting) await prisma.appSettings.update({ where: { id: 'singleton' }, data: setting })
    }
  })

  it('demo logins are only offered when DEMO_MODE=true', () => {
    vi.stubEnv('DEMO_MODE', '')
    expect(getDemoAccounts()).toEqual([])
    vi.stubEnv('DEMO_MODE', 'true')
    expect(getDemoAccounts().map((a) => a.email)).toContain('admin@company.com')
    vi.unstubAllEnvs()
  })
})

// ────────────────────────────────────────────────────────
// TEST 12: Sign-in rate limiting
// ────────────────────────────────────────────────────────
describe('Test 12: Sign-in Rate Limiting', () => {
  const email = `test-ratelimit-${stamp}@test.com`
  const fromAddress = (ip: string) => vi.mocked(headers).mockResolvedValue(new Headers({ 'x-forwarded-for': ip }) as never)
  const attempt = (password: string, who = email) => login(undefined, form({ email: who, password }))

  beforeAll(async () => {
    await createUser('Rate Limited', email, 'EMPLOYEE')
  })

  it('locks an account for 15 minutes after 5 wrong passwords, even for the right password', async () => {
    fromAddress('203.0.113.10')
    for (let i = 0; i < 5; i++) expect(await attempt('wrong-password')).toEqual({ error: 'invalid_credentials' })

    vi.mocked(createSession).mockClear()
    expect(await attempt(PASSWORD)).toEqual({ error: 'too_many_attempts', retryAfterMinutes: 15 })
    expect(createSession).not.toHaveBeenCalled()

    // Another address does not help: the limit is per account
    fromAddress('203.0.113.11')
    expect(await attempt(PASSWORD)).toMatchObject({ error: 'too_many_attempts' })
  })

  it('allows the account again once the 15-minute window has passed', async () => {
    await prisma.rateLimit.update({
      where: { key: `login:account:${email}` },
      data: { windowStart: new Date(Date.now() - 16 * 60 * 1000) },
    })
    await expect(attempt(PASSWORD)).rejects.toThrow(/^NEXT_REDIRECT \/tickets$/)
  })

  it('a successful sign-in resets the count of failures', async () => {
    fromAddress('203.0.113.12')
    for (let i = 0; i < 4; i++) await attempt('wrong-password')
    await expect(attempt(PASSWORD)).rejects.toThrow('NEXT_REDIRECT')
    for (let i = 0; i < 4; i++) await attempt('wrong-password')
    expect(await attempt('wrong-password')).toEqual({ error: 'invalid_credentials' })
  })

  it('locks out an address that tries many accounts', async () => {
    fromAddress('203.0.113.13')
    for (let i = 0; i < 20; i++) {
      expect(await attempt('guess', `unknown-${stamp}-${i}@test.com`)).toEqual({ error: 'invalid_credentials' })
    }
    expect(await attempt('guess', `unknown-${stamp}-x@test.com`)).toMatchObject({ error: 'too_many_attempts' })
    // Other people are not affected
    fromAddress('203.0.113.14')
    await expect(login(undefined, form({ email: employeeEmail, password: PASSWORD }))).rejects.toThrow('NEXT_REDIRECT')
  })
})

// ────────────────────────────────────────────────────────
// TEST 13: Server-side validation — nothing the browser sends is trusted
// ────────────────────────────────────────────────────────
describe('Test 13: Server-side Validation', () => {
  const ticketForm = (fields: Record<string, string> = {}) =>
    form({ title: 'Validation ticket', description: 'Checking what the server accepts.', category: 'Network', ...fields })
  const created = (title: string) => prisma.ticket.findFirst({ where: { createdById: employeeId, title } })

  it('a ticket needs one of the admin categories and a real priority', async () => {
    signInAs(employeeId, 'EMPLOYEE')
    expect(await createTicket(undefined, ticketForm({ category: 'Made Up' }))).toEqual({ fieldErrors: { category: true } })
    expect(await createTicket(undefined, ticketForm({ priority: 'URGENT' }))).toEqual({ error: 'invalid_priority' })
    expect(await createTicket(undefined, ticketForm({ title: 'x'.repeat(201) }))).toEqual({ fieldErrors: { title: true } })
    expect(await created('Validation ticket')).toBeNull()
  })

  it('a ticket can only use the requester\'s own uploads that are not attached elsewhere', async () => {
    signInAs(itSupportId, 'IT_SUPPORT')
    const someoneElses = await uploadPng()
    signInAs(employeeId, 'EMPLOYEE')
    const mine = await uploadPng()
    const attach = (ids: unknown) => createTicket(undefined, ticketForm({ attachmentIds: typeof ids === 'string' ? ids : JSON.stringify(ids) }))

    for (const ids of [[someoneElses], ['no-such-upload'], [mine, mine], Array(6).fill(mine), 'not json', [42]]) {
      expect(await attach(ids), JSON.stringify(ids)).toEqual({ error: 'invalid_attachments' })
    }
    expect(await created('Validation ticket')).toBeNull()

    await expect(createTicket(undefined, ticketForm({ title: 'With attachment', attachmentIds: JSON.stringify([mine]) }))).rejects.toThrow('NEXT_REDIRECT')
    const ticket = await created('With attachment')
    expect((await prisma.attachment.findUniqueOrThrow({ where: { id: mine } })).ticketId).toBe(ticket!.id)
    // Already used: can't be attached to a second ticket
    expect(await attach([mine])).toEqual({ error: 'invalid_attachments' })
  })

  it('attachments are only served to people who may see the ticket', async () => {
    const fetchFile = async (id: string) => fileGET(new NextRequest(`http://localhost/api/files/${id}`), { params: Promise.resolve({ id }) })
    signInAs(employeeId, 'EMPLOYEE')
    const id = await uploadPng('proof.png')

    // Before the ticket exists only the uploader can see it
    expect((await fetchFile(id)).status).toBe(200)
    signInAs(itSupportId, 'IT_SUPPORT')
    expect((await fetchFile(id)).status).toBe(404)

    signInAs(employeeId, 'EMPLOYEE')
    await expect(createTicket(undefined, ticketForm({ title: 'Private file', attachmentIds: JSON.stringify([id]) }))).rejects.toThrow('NEXT_REDIRECT')

    signInAs(itSupportId, 'IT_SUPPORT')
    const res = await fetchFile(id)
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('png-bytes')
    expect(res.headers.get('content-type')).toBe('image/png')
    expect(res.headers.get('x-content-type-options')).toBe('nosniff')
    expect(res.headers.get('content-security-policy')).toMatch(/^sandbox/)
    expect(res.headers.get('cache-control')).toMatch(/^private/)

    const otherEmployee = await createUser('Other Employee', `test-other-employee-${stamp}@test.com`, 'EMPLOYEE')
    signInAs(otherEmployee, 'EMPLOYEE')
    expect((await fetchFile(id)).status).toBe(404)
    signedOut()
    expect((await fetchFile(id)).status).toBe(401)
  })

    it('tickets created at the same moment still get different numbers', async () => {
    signInAs(employeeId, 'EMPLOYEE')
    const results = await Promise.allSettled(
      Array.from({ length: 6 }, (_, i) => createTicket(undefined, ticketForm({ title: `Concurrent ticket ${i}` }))),
    )
    expect(results.every((r) => r.status === 'rejected' && String(r.reason).includes('NEXT_REDIRECT /tickets?created=true'))).toBe(true)
    const tickets = await prisma.ticket.findMany({ where: { createdById: employeeId, title: { startsWith: 'Concurrent ticket' } } })
    expect(new Set(tickets.map((t) => t.ticketNumber)).size).toBe(6)
  })

  it('tickets can only be given to active IT support staff', async () => {
    const ticketId = await createTestTicket(employeeId)
    const suspendedAgent = await createUser('Suspended Agent', `test-suspended-agent-${stamp}@test.com`, 'IT_SUPPORT', 'SUSPENDED')
    signInAs(itSupportId, 'IT_SUPPORT')
    expect(await assignTicket(ticketId, employeeId)).toEqual({ error: 'invalid_assignee' })
    expect(await assignTicket(ticketId, suspendedAgent)).toEqual({ error: 'invalid_assignee' })
    signInAs(adminId, 'ADMIN')
    expect(await reassignTicket(ticketId, adminId)).toEqual({ error: 'invalid_assignee' })
    expect(await reassignTicket(ticketId, itPeerId)).toEqual({})
  })

  it('a closed ticket cannot be taken over or reassigned', async () => {
    const ticketId = await createTestTicket(employeeId, { status: 'CLOSED', assignedToId: itPeerId })
    signInAs(itSupportId, 'IT_SUPPORT')
    expect(await takeOverTicket(ticketId)).toEqual({ error: 'ticket_closed' })
    expect(await assignTicket(ticketId, itSupportId)).toEqual({ error: 'ticket_closed' })
  })

  it('when two agents claim the same ticket at once, only one wins', async () => {
    const ticketId = await createTestTicket(employeeId)
    vi.mocked(getSession)
      .mockResolvedValueOnce({ userId: itSupportId, role: 'IT_SUPPORT', name: 'A' } as SessionPayload)
      .mockResolvedValueOnce({ userId: itPeerId, role: 'IT_SUPPORT', name: 'B' } as SessionPayload)
    const results = await Promise.all([updateTicketStatus(ticketId, 'ASSIGNED'), updateTicketStatus(ticketId, 'ASSIGNED')])

    expect(results.filter((r) => !r.error)).toHaveLength(1)
    expect(results.find((r) => r.error)?.error).toMatch(/^(stale|assigned_to_other|invalid_transition)$/)
    expect(await prisma.ticketHistory.count({ where: { ticketId, event: 'status_changed' } })).toBe(1)
  })

  it('comments must exist, be non-empty and not too long, on a real ticket', async () => {
    const ticketId = await createTestTicket(employeeId)
    signInAs(employeeId, 'EMPLOYEE')
    expect(await addComment(ticketId, '   ')).toEqual({ error: 'comment_empty' })
    expect(await addComment(ticketId, 'x'.repeat(5001))).toEqual({ error: 'comment_too_long', params: { max: 5000 } })
    signInAs(itSupportId, 'IT_SUPPORT')
    expect(await addComment('no-such-ticket', 'Hello')).toEqual({ error: 'not_found' })
  })

  it('a ticket can be rated once, from 1 to 5, after it is resolved', async () => {
    const openId = await createTestTicket(employeeId)
    const resolvedId = await createTestTicket(employeeId, { status: 'RESOLVED', assignedToId: itSupportId })
    signInAs(employeeId, 'EMPLOYEE')
    expect(await submitCsatRating(openId, 5)).toEqual({ error: 'not_resolved' })
    expect(await submitCsatRating(resolvedId, 4.5)).toEqual({ error: 'invalid_rating' })
    expect(await submitCsatRating(resolvedId, 4, 'Quick fix')).toEqual({})
    expect(await submitCsatRating(resolvedId, 1)).toEqual({ error: 'already_rated' })
    expect((await prisma.ticket.findUnique({ where: { id: resolvedId } }))?.csatRating).toBe(4)
  })

  it('an admin cannot suspend or demote themselves', async () => {
    signInAs(adminId, 'ADMIN')
    expect(await updateUserStatus(adminId, 'SUSPENDED')).toEqual({ error: 'cannot_change_self' })
    expect(await updateUserRole(adminId, 'EMPLOYEE')).toEqual({ error: 'cannot_change_self' })
    expect((await prisma.user.findUnique({ where: { id: adminId } }))).toMatchObject({ role: 'ADMIN', accountStatus: 'APPROVED' })
  })

  it('the account request form does not reveal whether an email is registered', async () => {
    vi.mocked(headers).mockResolvedValue(new Headers({ 'x-forwarded-for': '203.0.113.20' }) as never)
    const request = (email: string) => register(undefined, form({ name: 'Someone', email, password: 'long-enough-1', role: 'EMPLOYEE' }))
    const before = await prisma.user.findUniqueOrThrow({ where: { id: employeeId } })

    expect(await request(employeeEmail)).toEqual({ success: true })
    expect(await prisma.user.findUniqueOrThrow({ where: { id: employeeId } })).toEqual(before)
  })

  it('limits account requests from one address', async () => {
    vi.mocked(headers).mockResolvedValue(new Headers({ 'x-forwarded-for': '203.0.113.21' }) as never)
    for (let i = 0; i < 5; i++) {
      const email = `test-register-${stamp}-${i}@test.com`
      expect(await register(undefined, form({ name: 'Someone', email, password: 'long-enough-1', role: 'IT_SUPPORT' }))).toEqual({ success: true })
      testUserIds.push((await prisma.user.findUniqueOrThrow({ where: { email } })).id)
    }
    const blocked = await register(undefined, form({ name: 'Someone', email: `test-register-${stamp}-x@test.com`, password: 'long-enough-1', role: 'IT_SUPPORT' }))
    expect(blocked).toMatchObject({ error: 'too_many_attempts' })
  })
})

// ────────────────────────────────────────────────────────
// TEST 14: AI usage limit — one user can't use up the Gemini quota
// ────────────────────────────────────────────────────────
describe('Test 14: AI Usage Limit', () => {
  let ticketId: string
  const exhaust = (userId: string) =>
    prisma.rateLimit.upsert({
      where: { key: `ai:user:${userId}` },
      create: { key: `ai:user:${userId}`, count: 30, windowStart: new Date() },
      update: { count: 30, windowStart: new Date() },
    })

  beforeAll(async () => {
    ticketId = await createTestTicket(employeeId)
  })

  it('counts each AI request against the user', async () => {
    const used = async () => (await prisma.rateLimit.findUnique({ where: { key: `ai:user:${itPeerId}` } }))?.count ?? 0
    const before = await used()
    signInAs(itPeerId, 'IT_SUPPORT')
    vi.mocked(translateText).mockResolvedValueOnce('مرحبا')
    expect(await translateAction({ text: 'hello', targetLanguage: 'Arabic' })).toEqual({ success: true, translation: 'مرحبا' })
    expect(await used()).toBe(before + 1)
  })

  it('over the limit, triage answers with the keyword rules without calling Gemini', async () => {
    await exhaust(employeeId)
    signInAs(employeeId, 'EMPLOYEE')
    vi.mocked(triageTicket).mockClear()
    const res = await triagePOST(
      new NextRequest('http://localhost/api/ai/triage', {
        method: 'POST',
        body: JSON.stringify({ title: 'Printer jam', description: 'The printer on floor 2 is jammed' }),
        headers: { 'content-type': 'application/json' },
      }),
    )
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ source: 'rules' })
    expect(triageTicket).not.toHaveBeenCalled()
  })

  it('over the limit, summaries and translation are refused', async () => {
    await exhaust(itSupportId)
    signInAs(itSupportId, 'IT_SUPPORT')
    vi.mocked(summarizeTicket).mockClear()
    vi.mocked(translateText).mockClear()

    const res = await summarizePOST(new NextRequest(`http://localhost/api/ai/summarize/${ticketId}`, { method: 'POST' }), {
      params: Promise.resolve({ id: ticketId }),
    })
    expect(res.status).toBe(429)
    expect(await translateAction({ text: 'hello', targetLanguage: 'Arabic' })).toEqual({ success: false, error: 'rate_limited' })
    expect(summarizeTicket).not.toHaveBeenCalled()
    expect(translateText).not.toHaveBeenCalled()
  })
})

// ────────────────────────────────────────────────────────
// TEST 15: Review fixes
// ────────────────────────────────────────────────────────
describe('Test 15: Review Fixes', () => {
  it('the users page checks for an admin itself, not only in the layout', async () => {
    signInAs(itSupportId, 'IT_SUPPORT')
    await expect(AdminUsersPage({ searchParams: Promise.resolve({}) })).rejects.toThrow('NEXT_REDIRECT /tickets')
    signInAs(adminId, 'ADMIN')
    const page = (await AdminUsersPage({ searchParams: Promise.resolve({}) })) as ReactElement<{ currentUserId: string }>
    expect(page.props.currentUserId).toBe(adminId)
  })

  it('claiming an unassigned ticket is logged as a claim, not "taken over from Unassigned"', async () => {
    const ticketId = await createTestTicket(employeeId)
    signInAs(itSupportId, 'IT_SUPPORT', 'Test IT Support')
    expect(await takeOverTicket(ticketId)).toEqual({})
    const entry = await prisma.ticketHistory.findFirstOrThrow({ where: { ticketId, event: 'taken_over' } })
    expect(entry.meta).toBe('{}')
    expect(entry.action).toBe('Ticket claimed by Test IT Support')
  })

  it('canned replies are read safely from the settings', () => {
    expect(parseCannedResponses('[{"id":"1","title":"T","content":"C"},{"id":2},"x"]')).toEqual([{ id: '1', title: 'T', content: 'C' }])
    expect(parseCannedResponses('not json')).toEqual([])
    expect(parseCannedResponses(null)).toEqual([])
  })
})

// ────────────────────────────────────────────────────────
// TEST 16: SLA on reopen, and tickets of agents who leave
// ────────────────────────────────────────────────────────
describe('Test 16: Reopened SLA & Agents Who Leave', () => {
  it('a reopened ticket gets a fresh SLA deadline but keeps an earlier breach', async () => {
    const past = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const ticketId = await createTestTicket(employeeId, { status: 'CLOSED', assignedToId: itSupportId, slaDeadline: past, slaBreached: true })
    signInAs(employeeId, 'EMPLOYEE')
    expect(await reopenTicket(ticketId, 'The printer broke again')).toEqual({})

    const ticket = await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId } })
    expect(ticket.status).toBe('IN_PROGRESS')
    expect(ticket.slaDeadline!.getTime()).toBeGreaterThan(Date.now())
    expect(ticket.slaBreached).toBe(true)
  })

  it.each([
    ['suspended', () => updateUserStatus(agentId, 'SUSPENDED')],
    ['made an employee', () => updateUserRole(agentId, 'EMPLOYEE')],
  ])('when an agent is %s, their unfinished tickets go back to the queue', async (_label, change) => {
    await prisma.user.update({ where: { id: agentId }, data: { role: 'IT_SUPPORT', accountStatus: 'APPROVED' } })
    const assigned = await createTestTicket(employeeId, { status: 'ASSIGNED', assignedToId: agentId })
    const working = await createTestTicket(employeeId, { status: 'IN_PROGRESS', assignedToId: agentId })
    const done = await createTestTicket(employeeId, { status: 'RESOLVED', assignedToId: agentId })

    signInAs(adminId, 'ADMIN', 'Test Admin')
    expect(await change()).toEqual({ returnedTickets: 2 })

    for (const id of [assigned, working]) {
      expect(await prisma.ticket.findUniqueOrThrow({ where: { id } })).toMatchObject({ status: 'OPEN', assignedToId: null })
      const entry = await prisma.ticketHistory.findFirstOrThrow({ where: { ticketId: id, event: 'returned_to_queue' } })
      expect(entry).toMatchObject({ userId: adminId, meta: JSON.stringify({ agent: 'Leaving Agent' }) })
    }
    // Finished work keeps its agent
    expect(await prisma.ticket.findUniqueOrThrow({ where: { id: done } })).toMatchObject({ status: 'RESOLVED', assignedToId: agentId })
  })

  it('approving or keeping an agent does not touch their tickets', async () => {
    await prisma.user.update({ where: { id: agentId }, data: { role: 'IT_SUPPORT', accountStatus: 'SUSPENDED' } })
    const ticketId = await createTestTicket(employeeId, { status: 'ASSIGNED', assignedToId: agentId })
    signInAs(adminId, 'ADMIN', 'Test Admin')
    expect(await updateUserStatus(agentId, 'APPROVED')).toEqual({})
    expect(await updateUserRole(agentId, 'IT_SUPPORT')).toEqual({})
    expect((await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId } })).assignedToId).toBe(agentId)
  })

  let agentId: string
  beforeAll(async () => {
    agentId = await createUser('Leaving Agent', `test-leaving-agent-${stamp}@test.com`, 'IT_SUPPORT')
  })
})

// ────────────────────────────────────────────────────────
// TEST 17: Audit fixes — exposed guards, sign-in timing, upload limits
// ────────────────────────────────────────────────────────
describe('Test 17: Audit Fixes', () => {
  const deleteFile = (id: string) => fileDELETE(new NextRequest(`http://localhost/api/files/${id}`, { method: 'DELETE' }), { params: Promise.resolve({ id }) })

  it("auth guards are not exported from a 'use server' file (where every export is a public endpoint)", () => {
    expect(Object.keys(authActions)).not.toEqual(expect.arrayContaining(['requireAuth']))
    expect(Object.keys(authActions).filter((k) => k.startsWith('require'))).toEqual([])
  })

  it('an unknown email still pays for a password check, so it takes as long as a wrong password', async () => {
    vi.mocked(headers).mockResolvedValue(new Headers({ 'x-forwarded-for': '203.0.113.30' }) as never)
    const compare = vi.spyOn(bcrypt, 'compare')
    try {
      expect(await login(undefined, form({ email: `nobody-${stamp}@test.com`, password: 'whatever-123' }))).toEqual({ error: 'invalid_credentials' })
      expect(compare).toHaveBeenCalledTimes(1)
    } finally {
      compare.mockRestore()
    }
  })

  it('an account request for a registered email still hashes the password', async () => {
    vi.mocked(headers).mockResolvedValue(new Headers({ 'x-forwarded-for': '203.0.113.31' }) as never)
    const hash = vi.spyOn(bcrypt, 'hash')
    try {
      expect(await register(undefined, form({ name: 'Someone', email: employeeEmail, password: 'long-enough-1', role: 'EMPLOYEE' }))).toEqual({ success: true })
      expect(hash).toHaveBeenCalledTimes(1)
    } finally {
      hash.mockRestore()
    }
  })

  it('a user can have at most 10 uploads waiting, and removing one frees a place', async () => {
    const uploader = await createUser('Uploader', `test-uploader-${stamp}@test.com`, 'EMPLOYEE')
    signInAs(uploader, 'EMPLOYEE')
    const ids: string[] = []
    for (let i = 0; i < 10; i++) ids.push(await uploadPng(`shot-${i}.png`))

    const res = await uploadPOST(uploadRequest(new File(['x'], 'one-more.png', { type: 'image/png' })))
    expect(res.status).toBe(429)
    expect(await res.json()).toEqual({ error: 'upload_pending_limit', params: { max: 10 } })

    expect((await deleteFile(ids[0])).status).toBe(204)
    expect(await prisma.attachment.findUnique({ where: { id: ids[0] } })).toBeNull()
    await uploadPng('one-more.png')
  })

  it('a user can upload at most 30 files an hour', async () => {
    const uploader = await createUser('Busy Uploader', `test-busy-uploader-${stamp}@test.com`, 'EMPLOYEE')
    await prisma.rateLimit.create({ data: { key: `upload:user:${uploader}`, count: 30, windowStart: new Date() } })
    signInAs(uploader, 'EMPLOYEE')
    const res = await uploadPOST(uploadRequest(new File(['x'], 'a.png', { type: 'image/png' })))
    expect(res.status).toBe(429)
    expect(await res.json()).toMatchObject({ error: 'too_many_attempts' })
  })

  it("only the uploader can delete an upload, and never once it belongs to a ticket", async () => {
    signInAs(employeeId, 'EMPLOYEE')
    const pending = await uploadPng('mine.png')
    signInAs(itSupportId, 'IT_SUPPORT')
    expect((await deleteFile(pending)).status).toBe(404)

    signInAs(employeeId, 'EMPLOYEE')
    await expect(
      createTicket(undefined, form({ title: 'Ticket with a kept file', description: 'This file must stay with the ticket.', category: 'Network', attachmentIds: JSON.stringify([pending]) })),
    ).rejects.toThrow('NEXT_REDIRECT')
    expect((await deleteFile(pending)).status).toBe(404)
    expect(await prisma.attachment.findUnique({ where: { id: pending } })).not.toBeNull()
  })
})
