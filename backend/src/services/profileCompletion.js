import { eq } from 'drizzle-orm'
import { db } from '../../db/index.js'
import {
  users,
  userPhotos,
  userPrompts,
  userInterests,
  userLifestyle,
} from '../../db/schema/users.js'

// A profile counts as "verified / complete" at this percentage. Tunable in one
// place — currently a fully-filled profile (the app shows the same %). Lower it
// if 100% proves too strict in practice.
export const VERIFIED_MIN_PCT = 100

const LIFESTYLE_FIELDS = [
  'height', 'drinks', 'smokes', 'kids', 'pets',
  'diet', 'exercise', 'religion', 'education', 'zodiac',
]

const filled = (v) => v != null && String(v).trim() !== ''

// Mirrors the app's local completion weighting (total 24 points) so the backend
// percentage matches exactly what the user sees on their profile:
//   handle, age, looking, bio  → 1 pt each
//   photos                     → up to 6
//   any interest               → 1 pt
//   prompts                    → up to 3
//   lifestyle fields           → up to 10
export async function computeProfileCompletion(userId, client = db) {
  const [u] = await client
    .select({
      handle: users.handle,
      age: users.age,
      looking: users.looking,
      bio: users.bio,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)
  if (!u) return 0

  const [photos, prompts, interests, lifestyleRows] = await Promise.all([
    client
      .select({ storageKey: userPhotos.storageKey, deletedAt: userPhotos.deletedAt })
      .from(userPhotos)
      .where(eq(userPhotos.userId, userId)),
    client.select({ answer: userPrompts.answer }).from(userPrompts).where(eq(userPrompts.userId, userId)),
    client.select({ interest: userInterests.interest }).from(userInterests).where(eq(userInterests.userId, userId)),
    client.select().from(userLifestyle).where(eq(userLifestyle.userId, userId)).limit(1),
  ])
  const lifestyle = lifestyleRows[0] || null

  let completed = 0
  let total = 0
  const bin = (ok) => { total += 1; if (ok) completed += 1 }
  const cnt = (n, max) => { total += max; completed += Math.min(Math.max(n, 0), max) }

  bin(filled(u.handle))
  bin(Number(u.age || 0) > 0)
  bin(filled(u.looking))
  bin(filled(u.bio))
  const realPhotos = photos.filter(
    (p) => p.deletedAt == null && p.storageKey && !String(p.storageKey).startsWith('users/tmp/'),
  )
  cnt(realPhotos.length, 6)
  bin(interests.some((i) => filled(i.interest)))
  cnt(prompts.filter((p) => filled(p.answer)).length, 3)
  const lsCount = lifestyle ? LIFESTYLE_FIELDS.filter((k) => filled(lifestyle[k])).length : 0
  cnt(lsCount, 10)

  return total === 0 ? 0 : Math.round((completed / total) * 100)
}

// Recompute + persist users.profile_complete_pct. Call after any profile edit.
export async function recomputeProfileCompletion(userId, client = db) {
  const pct = await computeProfileCompletion(userId, client)
  await client
    .update(users)
    .set({ profileCompletePct: pct, updatedAt: new Date() })
    .where(eq(users.id, userId))
  return pct
}
