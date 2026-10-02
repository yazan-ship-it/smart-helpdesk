/**
 * One-off: fill the event/meta columns for audit rows written before events
 * existed, so they can be shown in the viewer's language. Safe to re-run.
 * Run: npm run db:backfill-history
 */
import { PrismaClient } from '@prisma/client'
import { legacyEventColumns } from '../lib/history'

const prisma = new PrismaClient()

async function main() {
  const rows = await prisma.ticketHistory.findMany({ where: { event: null }, select: { id: true, action: true } })
  let converted = 0
  const unknown: string[] = []
  for (const row of rows) {
    const columns = legacyEventColumns(row.action)
    if (!columns.event) {
      unknown.push(row.action)
      continue
    }
    await prisma.ticketHistory.update({ where: { id: row.id }, data: columns })
    converted++
  }
  console.log(`Converted ${converted} of ${rows.length} rows.`)
  if (unknown.length) console.log('Left as text (not recognised):', [...new Set(unknown)])
}

main().finally(() => prisma.$disconnect())
