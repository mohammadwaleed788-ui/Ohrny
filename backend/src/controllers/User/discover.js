import { sql, inArray } from 'drizzle-orm'
import { db } from '../../../db/index.js'
import { users, userPhotos, userPrompts, userInterests } from '../../../db/schema/users.js'
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

function mapRelationshipPreference(relType) {
  const value = String(relType || 'dating')
  if (value === 'open') return ['non_monogamy']
  return [value]
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

    const viewerPointSql = sql`ST_SetSRID(
      ST_MakePoint(
        CAST(${currentUser.lngApprox} AS double precision),
        CAST(${currentUser.latApprox} AS double precision)
      ),
      4326
    )::geography`

    const candidatePointSql = sql`ST_SetSRID(
      ST_MakePoint(
        CAST(${users.lngApprox} AS double precision),
        CAST(${users.latApprox} AS double precision)
      ),
      4326
    )::geography`

    const distanceMetersSql = sql`ST_Distance(${viewerPointSql}, ${candidatePointSql})`
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
      sql`ST_DWithin(${viewerPointSql}, ${candidatePointSql}, ${maxMeters})`,
      sql`${distanceMetersSql} >= ${minMeters}`,
    ]

    if (cursor) {
      whereParts.push(
        sql`(${distanceMilesSql} > ${cursor.distance} OR (${distanceMilesSql} = ${cursor.distance} AND ${users.id} > ${cursor.id}))`,
      )
    }

    const rows = await db
      .select({
        id: users.id,
        handle: users.handle,
        age: users.age,
        pronouns: users.pronouns,
        looking: users.looking,
        relationshipGoal: users.relationshipGoal,
        verified: users.idVerified,
        distanceMiles: distanceMilesSql,
        mainPhoto: sql`(
          select ${userPhotos.storageKey}
          from ${userPhotos}
          where ${userPhotos.userId} = ${users.id}
            and ${userPhotos.deletedAt} is null
          order by ${userPhotos.isMain} desc, ${userPhotos.position} asc
          limit 1
        )`,
        promptTitle: sql`(
          select ${userPrompts.title}
          from ${userPrompts}
          where ${userPrompts.userId} = ${users.id}
          order by ${userPrompts.position} asc
          limit 1
        )`,
        promptAnswer: sql`(
          select ${userPrompts.answer}
          from ${userPrompts}
          where ${userPrompts.userId} = ${users.id}
          order by ${userPrompts.position} asc
          limit 1
        )`,
        interests: sql`coalesce((
          select array_agg(interest_row.interest order by interest_row.position asc)
          from (
            select ${userInterests.interest}, ${userInterests.position}
            from ${userInterests}
            where ${userInterests.userId} = ${users.id}
            order by ${userInterests.position} asc
            limit 6
          ) as interest_row
        ), '{}'::text[])`,
      })
      .from(users)
      .where(sql.join(whereParts, sql` and `))
      .orderBy(sql`${distanceMilesSql} asc`, users.id)
      .limit(limit + 1)

    const hasMore = rows.length > limit
    const sliced = hasMore ? rows.slice(0, limit) : rows

    const cards = sliced.map((row) => {
      const distanceMiles = Number(row.distanceMiles)
      return {
        id: row.id,
        handle: row.handle,
        age: row.age,
        pronouns: row.pronouns,
        looking: row.looking,
        relationshipGoal: row.relationshipGoal,
        verified: Boolean(row.verified),
        distanceMiles: Number(distanceMiles.toFixed(2)),
        distanceLabel: `${Math.max(1, Math.round(distanceMiles))} mi`,
        mainPhoto: row.mainPhoto,
        prompt: row.promptTitle || row.promptAnswer
          ? { title: row.promptTitle, answer: row.promptAnswer }
          : null,
        interests: Array.isArray(row.interests) ? row.interests : [],
      }
    })

    const last = cards[cards.length - 1]
    const nextCursor = hasMore && last
      ? encodeCursor(last.distanceMiles, last.id)
      : null

    return res.json({
      cards,
      nextCursor,
      hasMore,
    })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Failed to load discovery cards' })
  }
}
