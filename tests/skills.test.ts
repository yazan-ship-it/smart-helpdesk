import { describe, it, expect } from 'vitest'
import { hasSkill, parseSkills, sanitizeSkills } from '@/lib/skills'
import { DEFAULT_CATEGORIES } from '@/lib/settings'

describe('agent skills', () => {
  it('maps the old short names to the current category names and removes duplicates', () => {
    expect(parseSkills(JSON.stringify(['Email', 'Email & Communication', 'Access Issue', 'Printer']))).toEqual([
      'Email & Communication',
      'Access & Permissions',
      'Printer',
    ])
  })

  it('survives empty or corrupt data', () => {
    expect(parseSkills(null)).toEqual([])
    expect(parseSkills('not json')).toEqual([])
    expect(parseSkills('{"a":1}')).toEqual([])
  })

  it('only keeps skills that are current categories', () => {
    expect(sanitizeSkills(['Email', 'Hacking', 'Printer', 42], DEFAULT_CATEGORIES)).toEqual(['Email & Communication', 'Printer'])
    expect(sanitizeSkills('Printer', DEFAULT_CATEGORIES)).toEqual([])
  })

  it('matches categories exactly, not as substrings of the JSON text', () => {
    const skills = JSON.stringify(['Email & Communication'])
    expect(hasSkill(skills, 'Email & Communication')).toBe(true)
    expect(hasSkill(skills, 'Email')).toBe(false)
    expect(hasSkill(skills, 'Communication')).toBe(false)
  })
})
