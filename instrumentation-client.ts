import * as Sentry from '@sentry/nextjs'
import { PRIVATE_DATA_COLLECTION, TRACES_SAMPLE_RATE } from '@/lib/monitoring'

// Error monitoring in the browser. Off unless NEXT_PUBLIC_SENTRY_DSN is set.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
    tracesSampleRate: TRACES_SAMPLE_RATE,
    dataCollection: PRIVATE_DATA_COLLECTION,
  })
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
