/**
 * Unit tests for the Gemini client wrapper. The Google SDK is mocked: no network, no quota used.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ApiError } from '@google/genai'

const generateContent = vi.fn()

vi.mock('@google/genai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@google/genai')>()
  return {
    ...actual,
    GoogleGenAI: class {
      models = { generateContent }
    },
  }
})

vi.stubEnv('GEMINI_API_KEY', 'test-key')
vi.stubEnv('GEMINI_MODEL', 'gemini-2.5-flash')
vi.stubEnv('GEMINI_FALLBACK_MODEL', 'gemini-2.5-flash-lite')

const { translateText, triageTicket, isAiConfigured } = await import('@/lib/gemini')

const rateLimited = () => new ApiError({ message: 'quota exceeded', status: 429 })

beforeEach(() => generateContent.mockReset())

describe('Gemini client', () => {
  it('treats the README placeholder key as not configured', () => {
    vi.stubEnv('GEMINI_API_KEY', 'your-gemini-api-key-here')
    expect(isAiConfigured()).toBe(false)
    vi.stubEnv('GEMINI_API_KEY', 'test-key')
    expect(isAiConfigured()).toBe(true)
  })

  it('falls back to the second model when the first is rate-limited', async () => {
    generateContent.mockRejectedValueOnce(rateLimited()).mockResolvedValueOnce({ text: 'مرحبا' })

    await expect(translateText('hello', 'Arabic')).resolves.toBe('مرحبا')
    expect(generateContent.mock.calls.map((c) => c[0].model)).toEqual(['gemini-2.5-flash', 'gemini-2.5-flash-lite'])
  })

  it('does not retry errors that another model would not fix', async () => {
    generateContent.mockRejectedValueOnce(new ApiError({ message: 'bad request', status: 400 }))

    await expect(translateText('hello', 'Arabic')).rejects.toThrow('bad request')
    expect(generateContent).toHaveBeenCalledTimes(1)
  })

  it('fails when every model is rate-limited, so callers can fall back honestly', async () => {
    generateContent.mockRejectedValueOnce(rateLimited()).mockRejectedValueOnce(rateLimited())
    let error: unknown
    try {
      await translateText('hello', 'Arabic')
    } catch (e) {
      error = e
    }
    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).status).toBe(429)
    expect(generateContent).toHaveBeenCalledTimes(2)
  })

  it('disables thinking on 2.5 models for speed', async () => {
    generateContent.mockResolvedValueOnce({ text: 'hi' })
    await translateText('hello', 'English')
    expect(generateContent.mock.calls[0][0].config.thinkingConfig).toEqual({ thinkingBudget: 0 })
  })

  it('rejects a triage answer with a category the admin does not have', async () => {
    generateContent.mockResolvedValueOnce({
      text: JSON.stringify({ category: 'Hacked', priority: 'HIGH', selfHelp: ['a', 'b'], reason: 'x' }),
    })
    await expect(triageTicket('t', 'd', ['Hardware', 'Other'], 'en')).rejects.toThrow(/category/)
  })
})
