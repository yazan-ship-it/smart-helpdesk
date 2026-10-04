import 'dotenv/config'
import { defineConfig } from 'prisma/config'

/**
 * Prisma CLI settings. Migrations need a direct connection (not the pooled one
 * the app uses), so the CLI connects with DIRECT_URL.
 */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'node scripts/seed.js',
  },
  datasource: {
    // Not env(): that throws when the variable is unset, and `prisma generate`
    // (run on npm install) doesn't need a database at all
    url: process.env.DIRECT_URL ?? '',
    // Scratch database for `migrate diff --from-migrations` (the CI schema check);
    // it gets wiped, so never point it at real data
    ...(process.env.SHADOW_DATABASE_URL ? { shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL } : {}),
  },
})
