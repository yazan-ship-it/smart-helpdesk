import 'server-only'

export type DemoAccount = {
  key: 'alice' | 'bob' | 'mike' | 'admin'
  role: 'EMPLOYEE' | 'IT_SUPPORT' | 'ADMIN'
  email: string
  password: string
}

/** The seeded accounts (prisma/seed.ts) offered as 1-click logins */
const DEMO_ACCOUNTS: DemoAccount[] = [
  { key: 'alice', role: 'EMPLOYEE', email: 'alice@company.com', password: 'employee123' },
  { key: 'bob', role: 'IT_SUPPORT', email: 'bob@company.com', password: 'support123' },
  { key: 'mike', role: 'IT_SUPPORT', email: 'mike@company.com', password: 'support123' },
  { key: 'admin', role: 'ADMIN', email: 'admin@company.com', password: 'admin123' },
]

/**
 * 1-click demo logins put passwords in the page, so they are off unless
 * DEMO_MODE=true. Never enable it on a deployment with real users.
 */
export function getDemoAccounts(): DemoAccount[] {
  return process.env.DEMO_MODE === 'true' ? DEMO_ACCOUNTS : []
}
