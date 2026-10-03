import { defineConfig } from 'vitest/config'
import { loadEnvFile } from 'process'
import path from 'path'

// TEST_DATABASE_URL usually lives in .env; CI sets it directly
try {
  loadEnvFile('.env')
} catch {
  // No .env file
}

/**
 * The tests run against their own database (TEST_DATABASE_URL, whose name must
 * contain "_test"), never the one the app uses. globalSetup resets it first.
 */
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL ?? ''

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // The test database may be in the cloud, so allow for network round trips
    testTimeout: 60000,
    hookTimeout: 120000,
    include: ['tests/**/*.test.ts'],
    globalSetup: ['tests/global-setup.ts'],
    env: {
      DATABASE_URL: TEST_DATABASE_URL,
      DIRECT_URL: TEST_DATABASE_URL,
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
      'server-only': path.resolve(__dirname, 'tests/stubs/server-only.ts'),
    },
  },
})
