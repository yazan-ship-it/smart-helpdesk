import * as Sentry from '@sentry/nextjs'
import { PRIVATE_DATA_COLLECTION, TRACES_SAMPLE_RATE } from '@/lib/monitoring'

/**
 * Error monitoring for the server (Node.js and the proxy's Edge runtime).
 * Off unless SENTRY_DSN is set, so local development and tests send nothing.
 */
export function register() {
  const dsn = process.env.SENTRY_DSN
  if (!dsn) return

  Sentry.init({
    dsn,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    tracesSampleRate: TRACES_SAMPLE_RATE,
    dataCollection: PRIVATE_DATA_COLLECTION,
  })
}

/** Errors in pages, Server Actions, route handlers and the proxy (a no-op when Sentry is off) */
export const onRequestError = Sentry.captureRequestError
