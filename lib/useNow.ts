'use client'

import { useEffect, useState } from 'react'

/**
 * The current time, refreshed every `intervalMs`, for countdowns such as
 * "due in 3h". Reading the clock during render would make components impure.
 */
export function useNow(intervalMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}
