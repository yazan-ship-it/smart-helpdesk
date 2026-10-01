import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database with clean English IT dataset...')

  // Clean up existing data
  await prisma.ticketHistory.deleteMany()
  await prisma.comment.deleteMany()
  await prisma.ticket.deleteMany()
  await prisma.user.deleteMany()

  // Create Admin user
  const adminPassword = await bcrypt.hash('admin123', 12)
  const admin = await prisma.user.create({
    data: {
      name: 'System Admin',
      email: 'admin@company.com',
      password: adminPassword,
      role: 'ADMIN',
      accountStatus: 'APPROVED',
      skills: '[]',
      isAvailable: false,
    },
  })

  // Create Employee user
  const employeePassword = await bcrypt.hash('employee123', 12)
  const employee = await prisma.user.create({
    data: {
      name: 'Alice Johnson',
      email: 'alice@company.com',
      password: employeePassword,
      role: 'EMPLOYEE',
      accountStatus: 'APPROVED',
      skills: '[]',
      isAvailable: true,
    },
  })

  // Create IT Support user — Bob handles Network, Email, Access, Printer
  const itSupportPassword = await bcrypt.hash('support123', 12)
  const bob = await prisma.user.create({
    data: {
      name: 'Bob Williams',
      email: 'bob@company.com',
      password: itSupportPassword,
      role: 'IT_SUPPORT',
      accountStatus: 'APPROVED',
      skills: JSON.stringify(['Network', 'Email', 'Access Issue', 'Email & Communication', 'Access & Permissions', 'Printer']),
      isAvailable: true,
    },
  })

  // Create IT Support user — Mike handles Hardware & Software
  const mike = await prisma.user.create({
    data: {
      name: 'Mike Davis',
      email: 'mike@company.com',
      password: itSupportPassword,
      role: 'IT_SUPPORT',
      accountStatus: 'APPROVED',
      skills: JSON.stringify(['Hardware', 'Software']),
      isAvailable: true,
    },
  })

  // Ticket 1: Printer paper jam (ASSIGNED → Bob)
  const ticket1 = await prisma.ticket.create({
    data: {
      ticketNumber: 101,
      title: 'Departmental laser printer paper jam on 3rd floor',
      description:
        'Paper tray 2 is reporting paper feed jam error code #E-204. Cleared visible jammed paper but error remains on console.',
      category: 'Printer',
      priority: 'MEDIUM',
      status: 'ASSIGNED',
      createdById: employee.id,
      assignedToId: bob.id,
    },
  })

  // Ticket 2: VPN Gateway connection drops (IN_PROGRESS → Bob)
  const ticket2 = await prisma.ticket.create({
    data: {
      ticketNumber: 102,
      title: 'VPN Gateway connection drops every 15 minutes',
      description:
        'Remote VPN tunnel via Cisco AnyConnect disconnects intermittently during active sessions.',
      category: 'Network',
      priority: 'HIGH',
      status: 'IN_PROGRESS',
      createdById: employee.id,
      assignedToId: bob.id,
    },
  })

  // Ticket 3: Unable to access central corporate database (CRITICAL, ASSIGNED → Bob)
  const ticket3 = await prisma.ticket.create({
    data: {
      ticketNumber: 103,
      title: 'Unable to access central corporate database',
      description:
        'Connection timeout when attempting to reach the primary SQL database server through ERP client.',
      category: 'Network',
      priority: 'CRITICAL',
      status: 'ASSIGNED',
      createdById: employee.id,
      assignedToId: bob.id,
    },
  })

  // Ticket 4: Microsoft 365 enterprise license activation failure (IN_PROGRESS → Mike)
  const ticket4 = await prisma.ticket.create({
    data: {
      ticketNumber: 104,
      title: 'Microsoft 365 enterprise license activation failure',
      description:
        'User Outlook and Excel apps prompt for subscription renewal despite valid corporate credentials.',
      category: 'Software',
      priority: 'MEDIUM',
      status: 'IN_PROGRESS',
      createdById: employee.id,
      assignedToId: mike.id,
    },
  })

  // Ticket 5: Failure sending emails through desktop Outlook client (RESOLVED → Mike)
  const ticket5 = await prisma.ticket.create({
    data: {
      ticketNumber: 105,
      title: 'Failure sending emails through desktop Outlook client',
      description:
        'Outbox items stuck with SMTP 550 relay access denied error code.',
      category: 'Email & Communication',
      priority: 'HIGH',
      status: 'RESOLVED',
      createdById: employee.id,
      assignedToId: mike.id,
    },
  })

  // Ticket 6: Production database server unreachable (CLOSED → Mike)
  const ticket6 = await prisma.ticket.create({
    data: {
      ticketNumber: 106,
      title: 'Production database server unreachable',
      description:
        'Core production cluster node is offline and failing health probes.',
      category: 'Hardware',
      priority: 'LOW',
      status: 'CLOSED',
      createdById: employee.id,
      assignedToId: mike.id,
    },
  })

  // Ticket 7: Request access permissions for staging database environment (OPEN, unassigned)
  const ticket7 = await prisma.ticket.create({
    data: {
      ticketNumber: 107,
      title: 'Request access permissions for staging database environment',
      description:
        'Need read/write developer credentials on the dev/test SQL database instance.',
      category: 'Access & Permissions',
      priority: 'MEDIUM',
      status: 'OPEN',
      createdById: employee.id,
    },
  })

  // Ticket 8: Main finance network printer offline and unreachable (ASSIGNED → Bob)
  const ticket8 = await prisma.ticket.create({
    data: {
      ticketNumber: 108,
      title: 'Main finance network printer offline and unreachable',
      description:
        'Network printer IP 192.168.1.105 is not responding to ICMP ping or print jobs.',
      category: 'Printer',
      priority: 'HIGH',
      status: 'ASSIGNED',
      createdById: employee.id,
      assignedToId: bob.id,
    },
  })

  // Add comments
  await prisma.comment.create({
    data: {
      content: 'Maintenance technician dispatched to inspect feed sensor and clean pickup rollers; a 10-page test print completed successfully.',
      ticketId: ticket1.id,
      authorId: bob.id,
    },
  })

  await prisma.comment.create({
    data: {
      content: 'Submitted license renewal request to licensing portal. Credentials should update automatically within 24 hours.',
      ticketId: ticket4.id,
      authorId: mike.id,
    },
  })

  await prisma.comment.create({
    data: {
      content: 'SMTP password was reset after a security policy update. Updated credentials in Outlook settings and confirmed outgoing emails are sending.',
      ticketId: ticket5.id,
      authorId: mike.id,
    },
  })

  // Add history entries
  await prisma.ticketHistory.createMany({
    data: [
      { ticketId: ticket1.id, userId: employee.id, action: 'Ticket #101 created' },
      { ticketId: ticket1.id, userId: employee.id, action: 'System auto-assigned ticket to Bob Williams based on category (Printer)' },

      { ticketId: ticket2.id, userId: employee.id, action: 'Ticket #102 created' },
      { ticketId: ticket2.id, userId: employee.id, action: 'System auto-assigned ticket to Bob Williams based on category (Network)' },
      { ticketId: ticket2.id, userId: bob.id, action: 'Status changed: ASSIGNED → IN_PROGRESS' },

      { ticketId: ticket3.id, userId: employee.id, action: 'Ticket #103 created' },
      { ticketId: ticket3.id, userId: employee.id, action: 'System auto-assigned ticket to Bob Williams based on category (Network)' },

      { ticketId: ticket4.id, userId: employee.id, action: 'Ticket #104 created' },
      { ticketId: ticket4.id, userId: employee.id, action: 'System auto-assigned ticket to Mike Davis based on category (Software)' },
      { ticketId: ticket4.id, userId: mike.id, action: 'Status changed: ASSIGNED → IN_PROGRESS' },

      { ticketId: ticket5.id, userId: employee.id, action: 'Ticket #105 created' },
      { ticketId: ticket5.id, userId: employee.id, action: 'System auto-assigned ticket to Mike Davis based on category (Email & Communication)' },
      { ticketId: ticket5.id, userId: mike.id, action: 'Status changed: ASSIGNED → IN_PROGRESS' },
      { ticketId: ticket5.id, userId: mike.id, action: 'Status changed: IN_PROGRESS → RESOLVED' },

      { ticketId: ticket6.id, userId: employee.id, action: 'Ticket #106 created' },
      { ticketId: ticket6.id, userId: employee.id, action: 'System auto-assigned ticket to Mike Davis based on category (Hardware)' },
      { ticketId: ticket6.id, userId: mike.id, action: 'Status changed: ASSIGNED → IN_PROGRESS' },
      { ticketId: ticket6.id, userId: mike.id, action: 'Status changed: IN_PROGRESS → RESOLVED' },
      { ticketId: ticket6.id, userId: mike.id, action: 'Status changed: RESOLVED → CLOSED' },

      { ticketId: ticket7.id, userId: employee.id, action: 'Ticket #107 created' },
      { ticketId: ticket7.id, userId: employee.id, action: 'No available specialist found — ticket queued in unassigned' },

      { ticketId: ticket8.id, userId: employee.id, action: 'Ticket #108 created' },
      { ticketId: ticket8.id, userId: employee.id, action: 'System auto-assigned ticket to Bob Williams based on category (Printer)' },
    ],
  })

  console.log('✅ Seeding complete! All 8 tickets restored in clean English IT terminology.')
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
