import { sql, inArray, and, isNull, asc, desc, eq } from 'drizzle-orm'
import { db } from '../../../db/index.js'
import { users, userPhotos, userPrompts, userInterests, userLifestyle } from '../../../db/schema/users.js'
import { userDiscoverPreferences, userPrivacySettings } from '../../../db/schema/settings.js'
import { likes, matches } from '../../../db/schema/matching.js'
import { blocks } from '../../../db/schema/safety.js'
import { userBoosts } from '../../../db/schema/subscriptions.js'
import { notifyNewLike, notifyNewMatch } from '../../services/notifications/likeNotification.js'
import { attachUsersToMatchRoom } from '../../socket/index.js'
import { assertCanSwipe, consumeSwipe, getEffectiveEntitlements } from '../../services/entitlementService.js'

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 50
const OPERATED_HANDLE_PREFIX = 'optest_'
const OPERATED_PHONE_PREFIX = '555019'
const OPERATED_PHONE_COUNTRY = '+1'

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

function sortPair(user1, user2) {
  return String(user1) < String(user2)
    ? { userAId: user1, userBId: user2 }
    : { userAId: user2, userBId: user1 }
}

export async function getDiscoverCards(req, res) {
  try {
    const limit = clampInt(req.query.limit, 1, MAX_LIMIT, DEFAULT_LIMIT)
    const cursor = decodeCursor(req.query.cursor)
    // resetPasses=true: re-show passed users but still hide liked ones.
    // resetAll=true: fully restart deck and ignore swipe history.
    const resetPasses = req.query.resetPasses === 'true'
    const resetAll = req.query.resetAll === 'true'

    const currentUserRows = await db
      .select({
        id: users.id,
        handle: users.handle,
        phone: users.phone,
        phoneCountry: users.phoneCountry,
        latApprox: users.latApprox,
        lngApprox: users.lngApprox,
        orientation: users.orientation,
      })
      .from(users)
      .where(sql`${users.id} = ${req.user.id}`)
      .limit(1)

    const currentUser = currentUserRows[0]
    const isOperatedUser = Boolean(
      currentUser &&
      String(currentUser.handle || '').startsWith(OPERATED_HANDLE_PREFIX) &&
      currentUser.phoneCountry === OPERATED_PHONE_COUNTRY &&
      String(currentUser.phone || '').startsWith(OPERATED_PHONE_PREFIX),
    )
    const operatedMode = req.query.operatedMode === 'true' && isOperatedUser

    if (!currentUser) {
      return res.status(404).json({ error: 'User not found' })
    }

    const [prefsRows, entitlements] = await Promise.all([
      db
      .select({
        maxDistance: userDiscoverPreferences.maxDistance,
        minDistance: userDiscoverPreferences.minDistance,
        ageMin: userDiscoverPreferences.ageMin,
        ageMax: userDiscoverPreferences.ageMax,
        relationshipType: userDiscoverPreferences.relationshipType,
        verifiedOnly: userDiscoverPreferences.verifiedOnly,
        advancedCompatibility: userDiscoverPreferences.advancedCompatibility,
        travelMode: userDiscoverPreferences.travelMode,
        globalMode: userDiscoverPreferences.globalMode,
      })
      .from(userDiscoverPreferences)
      .where(sql`${userDiscoverPreferences.userId} = ${req.user.id}`)
      .limit(1),
      getEffectiveEntitlements(req.user.id),
    ])

    const prefs = prefsRows[0] || {}
    const globalMode = operatedMode
      ? true
      : Boolean(prefs.globalMode && entitlements?.features.globalMode)
    const travelMode = Boolean(prefs.travelMode && entitlements?.features.travelMode)
    const advancedCompatibility = Boolean(
      prefs.advancedCompatibility && entitlements?.features.advancedCompatibility,
    )
    const verifiedOnly = Boolean(prefs.verifiedOnly && entitlements?.features.verifiedOnly)
    const maxDistance = operatedMode ? 200 : clampInt(prefs.maxDistance, 1, 200, 25)
    const minDistance = operatedMode ? 0 : clampInt(prefs.minDistance, 0, 100, 0)
    const ageMin = operatedMode ? 18 : clampInt(prefs.ageMin, 18, 99, 18)
    const ageMax = operatedMode ? 99 : clampInt(prefs.ageMax, 18, 99, 70)
    const safeMinDistance = Math.min(minDistance, maxDistance)
    const safeAgeMin = Math.min(ageMin, ageMax)
    const safeAgeMax = Math.max(ageMin, ageMax)
    const relationshipTargets = operatedMode
      ? ALL_REL_GOALS
      : mapRelationshipPreference(prefs.relationshipType)

    const latPattern = '^-?[0-9]+(\\.[0-9]+)?$'
    const lngPattern = '^-?[0-9]+(\\.[0-9]+)?$'

    // Coordinates are stored as varchar, so a bare CAST(... AS double precision)
    // throws (status 500) on empty/garbage values — and Postgres does NOT
    // guarantee the regex guard in WHERE runs before the CAST. So: parse our own
    // coords in JS, and cast a candidate's coords only inside a CASE that checks
    // the numeric pattern first (→ NULL otherwise, which the bounds filter drops).
    const coordRe = /^-?[0-9]+(\.[0-9]+)?$/
    const parseCoord = (v) =>
      typeof v === 'number' && Number.isFinite(v)
        ? v
        : typeof v === 'string' && coordRe.test(v.trim())
          ? Number(v)
          : null
    const vLatNum = parseCoord(currentUser.latApprox)
    const vLngNum = parseCoord(currentUser.lngApprox)
    const hasSelfLocation = vLatNum != null && vLngNum != null
    // Distance filtering only when local (non-global) AND we know where we are.
    const distanceMode = !globalMode && hasSelfLocation

    const safeLat = sql`CASE WHEN ${users.latApprox} ~ ${latPattern} THEN CAST(${users.latApprox} AS double precision) END`
    const safeLng = sql`CASE WHEN ${users.lngApprox} ~ ${lngPattern} THEN CAST(${users.lngApprox} AS double precision) END`
    const distanceMetersSql = sql`(
      6371000.0 * 2.0 * asin(
        least(1.0, sqrt(
          power(sin((radians(${safeLat}) - radians(${vLatNum}::double precision)) / 2.0), 2) +
          cos(radians(${vLatNum}::double precision)) *
          cos(radians(${safeLat})) *
          power(sin((radians(${safeLng}) - radians(${vLngNum}::double precision)) / 2.0), 2)
        ))
      )
    )`
    const distanceMilesSql = sql`(${distanceMetersSql} / 1609.344)`
    const minMeters = (travelMode ? 0 : safeMinDistance) * 1609.344
    const maxMeters = (travelMode ? Math.max(maxDistance, 500) : maxDistance) * 1609.344

    // Base conditions shared by both the main query and the exhausted check.
    // Does NOT include swipe-history exclusion or cursor so we can reuse it.
    const baseWhereParts = [
      sql`${users.id} <> ${req.user.id}`,
      sql`${users.isBanned} = false`,
      sql`${users.isPaused} = false`,
      sql`${users.deletedAt} is null`,
      sql`${users.age} >= ${safeAgeMin}`,
      sql`${users.age} <= ${safeAgeMax}`,
      inArray(users.relationshipGoal, relationshipTargets),
      sql`NOT EXISTS (
        SELECT 1 FROM ${userPrivacySettings} ups
        WHERE ups.user_id = ${users.id}
          AND ups.incognito_mode = true
      )`,
    ]
    if (verifiedOnly) {
      baseWhereParts.push(eq(users.idVerified, true))
    }
    if (advancedCompatibility) {
      baseWhereParts.push(sql`coalesce(${users.profileCompletePct}, 0) >= 40`)
    }

    if (distanceMode) {
      baseWhereParts.push(
        sql`${users.latApprox} ~ ${latPattern}`,
        sql`${users.lngApprox} ~ ${lngPattern}`,
        sql`${distanceMetersSql} <= ${maxMeters}`,
        sql`${distanceMetersSql} >= ${minMeters}`,
      )
    }

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
        baseWhereParts.push(inArray(users.iam, iamTargets))
      }
    }

    // Full query = base + swipe-history exclusion + cursor
    const whereParts = [...baseWhereParts]

    // Exclude users already swiped. On "start again" (resetPasses=true) only
    // liked/super_liked users are hidden; passed users re-enter the deck.
    if (resetAll) {
      // No swipe-history exclusion on full restart.
    } else if (resetPasses) {
      whereParts.push(
        sql`NOT EXISTS (
          SELECT 1 FROM ${likes} sl
          WHERE sl.from_user_id = ${req.user.id}
            AND sl.to_user_id = ${users.id}
            AND sl.type IN ('like', 'super_like')
        )`,
      )
    } else {
      whereParts.push(
        sql`NOT EXISTS (
          SELECT 1 FROM ${likes} sl
          WHERE sl.from_user_id = ${req.user.id}
            AND sl.to_user_id = ${users.id}
        )`,
      )
    }

    if (cursor) {
      if (!distanceMode) {
        whereParts.push(sql`${users.id} > ${cursor.id}`)
      } else {
        whereParts.push(
          sql`(${distanceMilesSql} > ${cursor.distance} OR (${distanceMilesSql} = ${cursor.distance} AND ${users.id} > ${cursor.id}))`,
        )
      }
    }

    // ── Step 1: fetch the user rows (no subqueries) ──────────────────────────
    const distanceSelectSql = distanceMode ? distanceMilesSql : sql`null`
    const boostedOrderSql = sql`(
      CASE WHEN EXISTS (
        SELECT 1 FROM ${userBoosts} ub
        WHERE ub.user_id = ${users.id}
          AND ub.is_active = true
          AND ub.expires_at > now()
      ) THEN 0 ELSE 1 END
    )`
    // Cast the enum to text: `relationshipType` is a UI preference value
    // (e.g. "open") that isn't necessarily a valid relationship_goal enum
    // member, so comparing it to the enum column directly throws 22P02.
    const compatibilityOrderSql = sql`(
      CASE
        WHEN ${users.relationshipGoal}::text = ${prefs.relationshipType || 'dating'} THEN 0
        WHEN ${users.idVerified} = true THEN 1
        ELSE 2
      END
    )`
    // Build the sort list simply: boosted first, then (only if the premium
    // feature is on) compatibility, then distance (local mode), then id.
    const orderByClause = [asc(boostedOrderSql)]
    if (advancedCompatibility) orderByClause.push(asc(compatibilityOrderSql))
    if (distanceMode) orderByClause.push(sql`${distanceMilesSql} asc`)
    orderByClause.push(asc(users.id))

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
        distanceMiles: distanceSelectSql,
      })
      .from(users)
      .where(sql.join(whereParts, sql` and `))
      .orderBy(...orderByClause)
      .limit(limit + 1)

    const hasMore = rows.length > limit
    const sliced = hasMore ? rows.slice(0, limit) : rows

    if (sliced.length === 0) {
      // Check if there are any matching users ignoring swipe history.
      // If yes → passes exhausted. If no → genuinely nobody nearby.
      const anyMatch = await db
        .select({ id: users.id })
        .from(users)
        .where(sql.join(baseWhereParts, sql` and `))
        .limit(1)
      return res.json({
        cards: [],
        nextCursor: null,
        hasMore: false,
        exhausted: anyMatch.length > 0,
      })
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
      const distanceMiles = row.distanceMiles != null ? Number(row.distanceMiles) : null
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
        distanceMiles: distanceMiles != null ? Number(distanceMiles.toFixed(2)) : null,
        distanceLabel: distanceMiles != null ? `${Math.max(1, Math.round(distanceMiles))} mi` : null,
        interests,
        photos,
        prompts,
        lifestyle,
      }
    })

    const lastRaw = sliced[sliced.length - 1]
    const nextCursor = hasMore && lastRaw
      ? encodeCursor(lastRaw.distanceMiles != null ? Number(lastRaw.distanceMiles) : 0, lastRaw.id)
      : null

    return res.json({ cards, nextCursor, hasMore })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Failed to load discovery cards' })
  }
}

export async function swipeDiscoverCard(req, res) {
  try {
    const fromUserId = req.user.id
    const { toUserId, type } = req.body || {}
    if (!toUserId || typeof toUserId !== 'string') {
      return res.status(400).json({ error: 'toUserId required' })
    }
    if (!['pass', 'like', 'super_like'].includes(type)) {
      return res.status(400).json({ error: 'Invalid swipe type' })
    }
    if (toUserId === fromUserId) {
      return res.status(400).json({ error: 'Cannot swipe yourself' })
    }

    const [target] = await db
      .select({
        id: users.id,
        isBanned: users.isBanned,
        isPaused: users.isPaused,
        deletedAt: users.deletedAt,
      })
      .from(users)
      .where(eq(users.id, toUserId))
      .limit(1)

    if (!target || target.isBanned || target.isPaused || target.deletedAt) {
      return res.status(404).json({ error: 'User not available' })
    }

    // TODO: re-enable before going live — disabled for testing so reported/blocked
    // users can still be swiped on during development.
    // const [blocked] = await db
    //   .select({ id: blocks.id })
    //   .from(blocks)
    //   .where(
    //     sql`(${blocks.blockerId} = ${fromUserId} and ${blocks.blockedId} = ${toUserId})
    //       or (${blocks.blockerId} = ${toUserId} and ${blocks.blockedId} = ${fromUserId})`,
    //   )
    //   .limit(1)
    // if (blocked) {
    //   return res.status(403).json({ error: 'Interaction not allowed' })
    // }

    const [existingSwipe] = await db
      .select({ id: likes.id, type: likes.type })
      .from(likes)
      .where(and(eq(likes.fromUserId, fromUserId), eq(likes.toUserId, toUserId)))
      .limit(1)

    const shouldConsumeSwipe = !existingSwipe
    const shouldConsumeSuperLike = type === 'super_like' && existingSwipe?.type !== 'super_like'
    if (shouldConsumeSwipe || shouldConsumeSuperLike) {
      const access = await assertCanSwipe(fromUserId, type)
      if (!access.ok) return res.status(access.status).json(access.body)
    }

    const now = new Date()
    await db.transaction(async (tx) => {
      await tx
        .insert(likes)
        .values({
          fromUserId,
          toUserId,
          type,
          matchId: null,
          seenAt: type === 'pass' ? now : null,
          createdAt: now,
        })
        .onConflictDoUpdate({
          target: [likes.fromUserId, likes.toUserId],
          set: {
            type,
            matchId: null,
            seenAt: type === 'pass' ? now : null,
            createdAt: now,
          },
        })
      if (shouldConsumeSwipe || shouldConsumeSuperLike) {
        await consumeSwipe(fromUserId, shouldConsumeSuperLike ? type : 'like', tx, { countSwipe: shouldConsumeSwipe })
      }
    })

    if (type === 'pass') {
      return res.json({ ok: true, swipeType: type, matched: false })
    }

    notifyNewLike(toUserId, fromUserId, type === 'super_like')

    const [reciprocal] = await db
      .select({ id: likes.id })
      .from(likes)
      .where(
        and(
          eq(likes.fromUserId, toUserId),
          eq(likes.toUserId, fromUserId),
          inArray(likes.type, ['like', 'super_like']),
        ),
      )
      .limit(1)

    if (!reciprocal) {
      return res.json({ ok: true, swipeType: type, matched: false })
    }

    const pair = sortPair(fromUserId, toUserId)
    const [matchRow] = await db
      .insert(matches)
      .values({
        userAId: pair.userAId,
        userBId: pair.userBId,
        isActive: true,
        unmatchedAt: null,
        unmatchedByUserId: null,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [matches.userAId, matches.userBId],
        set: {
          isActive: true,
          unmatchedAt: null,
          unmatchedByUserId: null,
          updatedAt: now,
        },
      })
      .returning({ id: matches.id })

    await db
      .update(likes)
      .set({ matchId: matchRow.id })
      .where(
        sql`(${likes.fromUserId} = ${fromUserId} and ${likes.toUserId} = ${toUserId})
            or (${likes.fromUserId} = ${toUserId} and ${likes.toUserId} = ${fromUserId})`,
      )

    notifyNewMatch(toUserId, fromUserId)
    notifyNewMatch(fromUserId, toUserId)
    try {
      await attachUsersToMatchRoom([fromUserId, toUserId], matchRow.id)
    } catch (err) {
      console.error('attachUsersToMatchRoom failed:', err.message)
    }

    return res.json({ ok: true, swipeType: type, matched: true, matchId: matchRow.id })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Failed to save swipe' })
  }
}

export async function getUserProfile(req, res) {
  try {
    const viewerId = req.user.id
    const targetId = req.params.userId
    if (!targetId || targetId === viewerId) {
      return res.status(400).json({ error: 'Invalid user' })
    }

    // TODO: re-enable before going live
    // const [blocked] = await db
    //   .select({ id: blocks.id })
    //   .from(blocks)
    //   .where(
    //     sql`(${blocks.blockerId} = ${viewerId} and ${blocks.blockedId} = ${targetId})
    //       or (${blocks.blockerId} = ${targetId} and ${blocks.blockedId} = ${viewerId})`,
    //   )
    //   .limit(1)
    // if (blocked) return res.status(403).json({ error: 'Profile not available' })

    const [row] = await db
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
        latApprox: users.latApprox,
        lngApprox: users.lngApprox,
        isBanned: users.isBanned,
        isPaused: users.isPaused,
        deletedAt: users.deletedAt,
      })
      .from(users)
      .where(eq(users.id, targetId))
      .limit(1)

    if (!row || row.isBanned || row.isPaused || row.deletedAt) {
      return res.status(404).json({ error: 'User not found' })
    }

    const [viewerRow, allPhotos, allPrompts, allInterests, allLifestyles] = await Promise.all([
      db.select({ latApprox: users.latApprox, lngApprox: users.lngApprox })
        .from(users).where(eq(users.id, viewerId)).limit(1),
      db.select().from(userPhotos)
        .where(and(eq(userPhotos.userId, targetId), isNull(userPhotos.deletedAt)))
        .orderBy(desc(userPhotos.isMain), asc(userPhotos.position)),
      db.select().from(userPrompts)
        .where(eq(userPrompts.userId, targetId))
        .orderBy(asc(userPrompts.position)),
      db.select().from(userInterests)
        .where(eq(userInterests.userId, targetId))
        .orderBy(asc(userInterests.position)),
      db.select().from(userLifestyle)
        .where(eq(userLifestyle.userId, targetId)),
    ])

    const viewer = viewerRow[0]
    const vLat = viewer?.latApprox
    const vLng = viewer?.lngApprox
    const rLat = row.latApprox
    const rLng = row.lngApprox

    let distanceMiles = null
    let distanceLabel = null
    const toNum = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null }
    const vLatN = toNum(vLat), vLngN = toNum(vLng), rLatN = toNum(rLat), rLngN = toNum(rLng)
    if (vLatN !== null && vLngN !== null && rLatN !== null && rLngN !== null) {
      const toRad = (d) => d * Math.PI / 180
      const dLat = toRad(rLatN - vLatN)
      const dLng = toRad(rLngN - vLngN)
      const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(vLatN)) * Math.cos(toRad(rLatN)) * Math.sin(dLng / 2) ** 2
      const miles = 3958.8 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
      distanceMiles = Number(miles.toFixed(2))
      distanceLabel = `${Math.max(1, Math.round(miles))} mi`
    }

    const lifestyle = allLifestyles[0]

    return res.json({
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
      distanceMiles,
      distanceLabel,
      interests: allInterests.slice(0, 6).map((i) => i.interest),
      photos: allPhotos.slice(0, 6).map((p) => ({
        id: p.id, storageKey: p.storageKey, position: p.position,
        isMain: p.isMain, isBlurred: p.isBlurred, blurAmount: p.blurAmount,
      })),
      prompts: allPrompts.slice(0, 3).map((p) => ({
        position: p.position, title: p.title, answer: p.answer,
      })),
      lifestyle: lifestyle ? {
        height: lifestyle.height ?? null, drinks: lifestyle.drinks ?? null,
        smokes: lifestyle.smokes ?? null, kids: lifestyle.kids ?? null,
        pets: lifestyle.pets ?? null, diet: lifestyle.diet ?? null,
        exercise: lifestyle.exercise ?? null, religion: lifestyle.religion ?? null,
        education: lifestyle.education ?? null, zodiac: lifestyle.zodiac ?? null,
      } : null,
    })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Failed to load profile' })
  }
}
