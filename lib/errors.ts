/**
 * Server actions and API routes return one of these codes instead of a
 * sentence; the client shows `errors.<code>` in the user's language.
 */
export const ERROR_CODES = [
  // General
  'unauthorized',
  'forbidden',
  'not_found',
  'maintenance',
  'failed',
  'too_many_attempts',
  // Tickets
  'invalid_category',
  'invalid_priority',
  'invalid_attachments',
  'invalid_transition',
  'stale',
  'assigned_to_other',
  'already_yours',
  'ticket_closed',
  'invalid_assignee',
  'comment_empty',
  'comment_too_long',
  'invalid_rating',
  'not_resolved',
  'reason_required',
  'already_rated',
  // Users
  'invalid_status',
  'invalid_role',
  'name_required',
  'invalid_email',
  'email_taken',
  'no_users_selected',
  'cannot_change_self',
  // Settings
  'settings_app_name',
  'settings_support_email',
  'settings_default_priority',
  'settings_sla_hours',
  'settings_time_format',
  'settings_hours_order',
  'settings_work_days',
  'settings_categories',
  'settings_domain',
  'settings_canned',
  // Uploads
  'upload_none',
  'upload_too_large',
  'upload_too_many',
  'upload_type',
  'upload_file_too_big',
] as const

export type ErrorCode = (typeof ERROR_CODES)[number]

export type ErrorParams = Record<string, string | number>

/** What a server action returns: nothing on success, or an error code */
export type ActionResult = { error?: ErrorCode; params?: ErrorParams }

export function fail(error: ErrorCode, params?: ErrorParams): ActionResult {
  return params ? { error, params } : { error }
}
