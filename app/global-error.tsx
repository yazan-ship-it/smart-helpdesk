'use client'

import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'

/**
 * Replaces the root layout when the layout itself fails, so neither the app's styles
 * nor its translations are available: the page is self-contained and bilingual.
 */
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: '#0f1115', color: '#e5e7eb' }}>
        <title>Smart Helpdesk</title>
        <main role="alert" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24, textAlign: 'center' }}>
          <h1 style={{ fontSize: 22, margin: 0 }}>Something went wrong</h1>
          <p dir="rtl" lang="ar" style={{ fontSize: 18, margin: 0 }}>حدث خطأ ما</p>
          <p style={{ fontSize: 14, color: '#9ca3af', maxWidth: 420, margin: 0 }}>
            The error has been reported. Please try again. / تم الإبلاغ عن الخطأ، حاول مرة أخرى.
          </p>
          {error.digest && <p style={{ fontSize: 12, fontFamily: 'monospace', color: '#9ca3af', margin: 0 }}>Ref: {error.digest}</p>}
          <button
            type="button"
            onClick={() => retry()}
            style={{ marginTop: 8, padding: '8px 18px', borderRadius: 10, border: 0, background: '#6366f1', color: '#fff', fontSize: 14, cursor: 'pointer' }}
          >
            Try again / حاول مرة أخرى
          </button>
        </main>
      </body>
    </html>
  )
}
