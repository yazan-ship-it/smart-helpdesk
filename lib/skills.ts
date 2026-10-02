/**
 * Agent skills are ticket categories: an agent with the "Printer" skill gets
 * Printer tickets. Pure helpers, safe to use on the client too.
 */

// Older data used shorter names for two categories
const LEGACY_SKILL_NAMES: Record<string, string> = {
  Email: 'Email & Communication',
  'Access Issue': 'Access & Permissions',
}

function normalize(skills: unknown[]): string[] {
  const names = skills
    .filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
    .map((s) => LEGACY_SKILL_NAMES[s.trim()] ?? s.trim())
  return [...new Set(names)]
}

/** Read the JSON skills column, mapping legacy names and removing duplicates. */
export function parseSkills(json: string | null | undefined): string[] {
  try {
    const parsed: unknown = json ? JSON.parse(json) : []
    return Array.isArray(parsed) ? normalize(parsed) : []
  } catch {
    return []
  }
}

/** Keep only skills that are current ticket categories. */
export function sanitizeSkills(skills: unknown, categories: string[]): string[] {
  return Array.isArray(skills) ? normalize(skills).filter((s) => categories.includes(s)) : []
}

export function hasSkill(skillsJson: string | null | undefined, category: string): boolean {
  return parseSkills(skillsJson).includes(category)
}
