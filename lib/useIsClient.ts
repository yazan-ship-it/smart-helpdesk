'use client'

import { useSyncExternalStore } from 'react'

const subscribe = () => () => {}

/**
 * false during SSR and hydration, true afterwards. Use it to skip rendering
 * browser-only UI (portals, charts, theme-dependent controls) on the server.
 */
export function useIsClient(): boolean {
  return useSyncExternalStore(subscribe, () => true, () => false)
}
