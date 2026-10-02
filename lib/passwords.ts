import 'server-only'
import { randomInt } from 'crypto'

export const MIN_PASSWORD_LENGTH = 8

// No 0/O, 1/l/I: the admin reads this out or pastes it into a message
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'

/** A one-time password for invited users, e.g. "k7Hm-2qXp-Rw9d" (~68 bits). */
export function generateTemporaryPassword(): string {
  const groups = Array.from({ length: 3 }, () =>
    Array.from({ length: 4 }, () => ALPHABET[randomInt(ALPHABET.length)]).join(''),
  )
  return groups.join('-')
}
