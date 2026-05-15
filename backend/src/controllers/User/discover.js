import { sql, inArray, and, isNull, asc, desc } from 'drizzle-orm'
import { db } from '../../../db/index.js'
import { users, userPhotos, userPrompts, userInterests, userLifestyle } from '../../../db/schema/users.js'
import { userDiscoverPreferences } from '../../../db/schema/settings.js'

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 50

function clampInt(value, min, max, fallback) {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.max(min, Math.min(max, Math.round(n)))
}

function decodeCursor(raw) {
  if (!raw || typeof raw !== 'string') return null
  try {
    const decoded = Buffer.from(raw, 'base64url').toString('utf8')
    const [distanceStr, id] = decoded.split('|')
    const distance = Number(distanceStr)
    if (!Number.isFinite(distance) || !id) return null
    return { distance, id }
  } catch {
    return null
  }
}

function encodeCursor(distance, id) {
  return Buffer.from(`${distance}|${id}`, 'utf8').toString('base64url')
}

const ALL_REL_GOALS = ['casual', 'dating', 'serious', 'non_monogamy', 'friends', 'figuring_out']

function mapRelationshipPreference(relType) {
  const value = String(relType || 'dating')
  if (value === 'open') return ALL_REL_GOALS
  if (value === 'enm') return ['non_monogamy']
  if (value === 'unsure') return ['figuring_out']
  return [value]
}

// Group an array of rows by a key field
function groupBy(rows, key) {
  const map = {}
  for (const row of rows) {
    const k = row[key]
    if (!map[k]) map[k] = []
    map[k].push(row)
  }
  return map
}

export async function getDiscoverCards(req, res) {
  try {
    const limit = clampInt(req.query.limit, 1, MAX_LIMIT, DEFAULT_LIMIT)
    const cursor = decodeCursor(req.query.cursor)

    const currentUserRows = await db
      .select({
        id: users.id,
        latApprox: users.latApprox,
        lngApprox: users.lngApprox,
        orientation: users.orientation,
      })
      .from(users)
      .where(sql`${users.id} = ${req.user.id}`)
      .limit(1)

    const currentUser = currentUserRows[0]
    if (!currentUser) {
      return res.status(404).json({ error: 'User not found' })
    }

    const prefsRows = await db
      .select({
        maxDistance: userDiscoverPreferences.maxDistance,
        minDistance: userDiscoverPreferences.minDistance,
        ageMin: userDiscoverPreferences.ageMin,
        ageMax: userDiscoverPreferences.ageMax,
        relationshipType: userDiscoverPreferences.relationshipType,
      })
      .from(userDiscoverPreferences)
      .where(sql`${userDiscoverPreferences.userId} = ${req.user.id}`)
      .limit(1)

    const prefs = prefsRows[0] || {}
    const maxDistance = clampInt(prefs.maxDistance, 1, 200, 25)
    const minDistance = clampInt(prefs.minDistance, 0, 100, 0)
    const ageMin = clampInt(prefs.ageMin, 18, 99, 18)
    const ageMax = clampInt(prefs.ageMax, 18, 99, 70)
    const safeMinDistance = Math.min(minDistance, maxDistance)
    const safeAgeMin = Math.min(ageMin, ageMax)
    const safeAgeMax = Math.max(ageMin, ageMax)
    const relationshipTargets = mapRelationshipPreference(prefs.relationshipType)

    const latPattern = '^-?[0-9]+(\\.[0-9]+)?$'
    const lngPattern = '^-?[0-9]+(\\.[0-9]+)?$'

    const vLat = currentUser.latApprox
    const vLng = currentUser.lngApprox
    const distanceMetersSql = sql`(
      6371000.0 * 2.0 * asin(
        least(1.0, sqrt(
          power(sin((radians(CAST(${users.latApprox} AS double precision)) - radians(CAST(${vLat} AS double precision))) / 2.0), 2) +
          cos(radians(CAST(${vLat} AS double precision))) *
          cos(radians(CAST(${users.latApprox} AS double precision))) *
          power(sin((radians(CAST(${users.lngApprox} AS double precision)) - radians(CAST(${vLng} AS double precision))) / 2.0), 2)
        ))
      )
    )`
    const distanceMilesSql = sql`(${distanceMetersSql} / 1609.344)`
    const minMeters = safeMinDistance * 1609.344
    const maxMeters = maxDistance * 1609.344

    const whereParts = [
      sql`${users.id} <> ${req.user.id}`,
      sql`${users.isBanned} = false`,
      sql`${users.isPaused} = false`,
      sql`${users.deletedAt} is null`,
      sql`${users.age} >= ${safeAgeMin}`,
      sql`${users.age} <= ${safeAgeMax}`,
      inArray(users.relationshipGoal, relationshipTargets),
      sql`${currentUser.latApprox} ~ ${latPattern}`,
      sql`${currentUser.lngApprox} ~ ${lngPattern}`,
      sql`${users.latApprox} ~ ${latPattern}`,
      sql`${users.lngApprox} ~ ${lngPattern}`,
      sql`${distanceMetersSql} <= ${maxMeters}`,
      sql`${distanceMetersSql} >= ${minMeters}`,
    ]

    // Gender filter — map orientation ('women','men','nonbinary') → iam ('woman','man','nonbinary')
    const orientationList = Array.isArray(currentUser.orientation) ? currentUser.orientation : []
    const wantsEveryone = orientationList.length === 0 || orientationList.includes('everyone')
    if (!wantsEveryone) {
      const iamTargets = [...new Set(
        orientationList
          .map(o => o === 'women' ? 'woman' : o === 'men' ? 'man' : o)
          .filter(o => ['woman', 'man', 'nonbinary', 'other'].includes(o))
      )]
      if (iamTargets.length > 0) {
        whereParts.push(inArray(users.iam, iamTargets))
      }
    }

    if (cursor) {
      whereParts.push(
        sql`(${distanceMilesSql} > ${cursor.distance} OR (${distanceMilesSql} = ${cursor.distance} AND ${users.id} > ${cursor.id}))`,
      )
    }

    // ── Step 1: fetch the user rows (no subqueries) ──────────────────────────
    const rows = await db
      .select({
        id: users.id,
        handle: users.handle,
        age: users.age,
        pronouns: users.pronouns,
        looking: users.looking,
        relationshipGoal: users.relationshipGoal,
        relStatus: users.relStatus,
        bio: users.bio,
        aboutMe: users.aboutMe,
        city: users.city,
        verified: users.idVerified,
        distanceMiles: distanceMilesSql,
      })
      .from(users)
      .where(sql.join(whereParts, sql` and `))
      .orderBy(sql`${distanceMilesSql} asc`, users.id)
      .limit(limit + 1)

    const hasMore = rows.length > limit
    const sliced = hasMore ? rows.slice(0, limit) : rows

    if (sliced.length === 0) {
      return res.json({ cards: [], nextCursor: null, hasMore: false })
    }

    // ── Step 2: batch-fetch all related data for these user IDs ──────────────
    const userIds = sliced.map((r) => r.id)

    const [allPhotos, allPrompts, allInterests, allLifestyles] = await Promise.all([
      db
        .select()
        .from(userPhotos)
        .where(and(inArray(userPhotos.userId, userIds), isNull(userPhotos.deletedAt)))
        .orderBy(desc(userPhotos.isMain), asc(userPhotos.position)),
      db
        .select()
        .from(userPrompts)
        .where(inArray(userPrompts.userId, userIds))
        .orderBy(asc(userPrompts.position)),
      db
        .select()
        .from(userInterests)
        .where(inArray(userInterests.userId, userIds))
        .orderBy(asc(userInterests.position)),
      db
        .select()
        .from(userLifestyle)
        .where(inArray(userLifestyle.userId, userIds)),
    ])

    // ── Step 3: group related rows by userId ─────────────────────────────────
    const photosByUser    = groupBy(allPhotos, 'userId')
    const promptsByUser   = groupBy(allPrompts, 'userId')
    const interestsByUser = groupBy(allInterests, 'userId')
    const lifestyleByUser = {}
    for (const ls of allLifestyles) lifestyleByUser[ls.userId] = ls

    // ── Step 4: build the final card objects ─────────────────────────────────
    const cards = sliced.map((row) => {
      const distanceMiles = Number(row.distanceMiles)
      const photos = (photosByUser[row.id] || []).slice(0, 6).map((p) => ({
        id: p.id,
        storageKey: p.storageKey,
        position: p.position,
        isMain: p.isMain,
        isBlurred: p.isBlurred,
        blurAmount: p.blurAmount,
      }))
      const prompts = (promptsByUser[row.id] || []).slice(0, 3).map((p) => ({
        position: p.position,
        title: p.title,
        answer: p.answer,
      }))
      const interests = (interestsByUser[row.id] || [])
        .slice(0, 6)
        .map((i) => i.interest)
      const lifestyle = lifestyleByUser[row.id]
        ? {
            height:    lifestyleByUser[row.id].height    ?? null,
            drinks:    lifestyleByUser[row.id].drinks    ?? null,
            smokes:    lifestyleByUser[row.id].smokes    ?? null,
            kids:      lifestyleByUser[row.id].kids      ?? null,
            pets:      lifestyleByUser[row.id].pets      ?? null,
            diet:      lifestyleByUser[row.id].diet      ?? null,
            exercise:  lifestyleByUser[row.id].exercise  ?? null,
            religion:  lifestyleByUser[row.id].religion  ?? null,
            education: lifestyleByUser[row.id].education ?? null,
            zodiac:    lifestyleByUser[row.id].zodiac    ?? null,
          }
        : null

      return {
        id: row.id,
        handle: row.handle,
        age: row.age,
        pronouns: row.pronouns ?? null,
        looking: row.looking ?? null,
        relStatus: row.relStatus ?? null,
        relationshipGoal: row.relationshipGoal ?? null,
        bio: row.bio ?? null,
        aboutMe: row.aboutMe ?? null,
        city: row.city ?? null,
        verified: Boolean(row.verified),
        distanceMiles: Number(distanceMiles.toFixed(2)),
        distanceLabel: `${Math.max(1, Math.round(distanceMiles))} mi`,
        interests,
        photos,
        prompts,
        lifestyle,
      }
    })

    const lastRaw = sliced[sliced.length - 1]
    const nextCursor = hasMore && lastRaw
      ? encodeCursor(Number(lastRaw.distanceMiles), lastRaw.id)
      : null

    return res.json({ cards, nextCursor, hasMore })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Failed to load discovery cards' })
  }
}
