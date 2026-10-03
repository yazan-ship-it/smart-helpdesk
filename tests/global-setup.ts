import { execSync } from 'child_process'
import { PrismaClient } from '@prisma/client'

/**
 * Runs once before the test files: rebuild the test database from the
 * migrations, then add the settings row the app expects to exist.
 */
export default async function setup() {
  const url = process.env.TEST_DATABASE_URL
  if (!url) {
    throw new Error('Set TEST_DATABASE_URL (in .env) to a separate database for the tests, e.g. helpdesk_test on Neon.')
  }
  if (!/_test$/.test(new URL(url).pathname)) {
    // Resetting wipes the database; refuse anything that doesn't look like a test one
    throw new Error('Refusing to reset TEST_DATABASE_URL: the database name must end in "_test".')
  }

  execSync('npx prisma migrate reset --force --skip-seed --skip-generate', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url },
  })

  const prisma = new PrismaClient({ datasources: { db: { url } } })
  await prisma.appSettings.create({ data: { id: 'singleton' } })
  await prisma.$disconnect()
}
