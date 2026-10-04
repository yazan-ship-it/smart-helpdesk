import type { BrowserOptions } from '@sentry/nextjs'

type DataCollection = NonNullable<BrowserOptions['dataCollection']>

/**
 * What Sentry may collect with an error. Its defaults include cookies, headers, request
 * bodies and local variables, which here would mean session cookies, passwords and ticket
 * text. We send only the error, its stack trace and the route.
 */
export const PRIVATE_DATA_COLLECTION: DataCollection = {
  userInfo: false,
  cookies: false,
  httpHeaders: false,
  httpBodies: [],
  urlQueryParams: false,
  genAI: { inputs: false, outputs: false },
  databaseQueryData: false,
  stackFrameVariables: false,
}

/** A sample of requests is enough to spot slow pages; every error is still reported */
export const TRACES_SAMPLE_RATE = 0.1
