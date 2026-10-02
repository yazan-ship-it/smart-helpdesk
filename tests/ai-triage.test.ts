/**
 * Unit tests for AI triage validation and the keyword-rule fallback (no database, no network).
 */

import { describe, it, expect } from 'vitest'
import { parseTriageResponse, ruleBasedTriage } from '@/lib/ai/triage'
import { DEFAULT_CATEGORIES } from '@/lib/settings'

const valid = {
  category: 'Network',
  priority: 'HIGH',
  selfHelp: ['Reconnect the VPN', '  ', 'Restart the laptop'],
  reason: ' VPN keeps dropping. ',
}

describe('parseTriageResponse', () => {
  it('accepts a valid answer and cleans it up', () => {
    expect(parseTriageResponse(valid, DEFAULT_CATEGORIES)).toEqual({
      category: 'Network',
      priority: 'HIGH',
      selfHelp: ['Reconnect the VPN', 'Restart the laptop'],
      reason: 'VPN keeps dropping.',
    })
  })

  it('rejects a category the admin has not configured', () => {
    expect(() => parseTriageResponse({ ...valid, category: 'Facilities' }, DEFAULT_CATEGORIES)).toThrow(/category/)
  })

  it('rejects an unknown priority', () => {
    expect(() => parseTriageResponse({ ...valid, priority: 'URGENT' }, DEFAULT_CATEGORIES)).toThrow(/priority/)
  })

  it('rejects an answer without self-help steps', () => {
    expect(() => parseTriageResponse({ ...valid, selfHelp: [] }, DEFAULT_CATEGORIES)).toThrow(/self-help/)
    expect(() => parseTriageResponse(null, DEFAULT_CATEGORIES)).toThrow()
  })
})

describe('ruleBasedTriage', () => {
  it('is always labelled as rules, never as AI', () => {
    expect(ruleBasedTriage('VPN drops', '', DEFAULT_CATEGORIES, 'en').source).toBe('rules')
  })

  it('prefers the more specific rule ("network printer" is a printer issue)', () => {
    const r = ruleBasedTriage('Network printer offline', 'The finance printer is not printing', DEFAULT_CATEGORIES, 'en')
    expect(r.category).toBe('Printer')
  })

  it('matches English keywords on word boundaries only', () => {
    // "happy" contains "app" but is not about software
    expect(ruleBasedTriage('Not happy with my chair', '', DEFAULT_CATEGORIES, 'en').category).toBe('Other')
  })

  it('understands Arabic tickets and answers in Arabic', () => {
    const r = ruleBasedTriage('الطابعة لا تعمل', 'تظهر رسالة خطأ', DEFAULT_CATEGORIES, 'ar')
    expect(r.category).toBe('Printer')
    expect(r.selfHelp[0]).toMatch(/[؀-ۿ]/)
    expect(r.reason).toMatch(/[؀-ۿ]/)
  })

  it('raises priority to CRITICAL for outages affecting everyone', () => {
    const r = ruleBasedTriage('VPN down', 'Nobody can connect, outage for everyone', DEFAULT_CATEGORIES, 'en')
    expect(r).toMatchObject({ category: 'Network', priority: 'CRITICAL' })
  })

  it('only suggests categories that exist in the admin settings', () => {
    const categories = ['Hardware', 'Other']
    expect(ruleBasedTriage('Outlook will not send email', '', categories, 'en').category).toBe('Other')
    expect(ruleBasedTriage('Outlook will not send email', '', ['Hardware'], 'en').category).toBe('Hardware')
  })
})
