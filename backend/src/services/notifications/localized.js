import { eq } from 'drizzle-orm'
import { db } from '../../../db/index.js'
import { users } from '../../../db/schema/users.js'
import { TEMPLATES } from './notificationTemplates.js'

// Replace {key} tokens in `str` with data[key]. Unknown placeholders are left
// as-is so a missing value never blows away surrounding copy.
export function interpolate(str, data = {}) {
  if (typeof str !== 'string') return str
  return str.replace(/\{(\w+)\}/g, (match, key) =>
    Object.prototype.hasOwnProperty.call(data, key) && data[key] != null
      ? String(data[key])
      : match,
  )
}

// Look up a user's preferred language, defaulting to 'en' on any miss/error.
export async function resolveLang(userId) {
  if (!userId) return 'en'
  try {
    const [row] = await db
      .select({ language: users.language })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)
    return row?.language || 'en'
  } catch {
    return 'en'
  }
}

// Build a localized { title, body } for the recipient. `keys` = { titleKey, bodyKey }.
// Falls back to the English string per-key when a translation is missing.
// If bodyKey is omitted, the body is taken verbatim from data.rawBody
// (used for user-generated content such as a support reply preview).
export async function localizedNotification(recipientUserId, keys = {}, data = {}) {
  const { titleKey, bodyKey } = keys
  const lang = await resolveLang(recipientUserId)
  const t = TEMPLATES[lang] || TEMPLATES.en

  const title = interpolate(t[titleKey] ?? TEMPLATES.en[titleKey], data)
  const body = bodyKey
    ? interpolate(t[bodyKey] ?? TEMPLATES.en[bodyKey], data)
    : data.rawBody

  return { title, body }
}
