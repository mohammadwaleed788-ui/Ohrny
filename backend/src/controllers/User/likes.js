import { and, desc, eq, inArray, isNull, or, sql } from 'drizzle-orm'
import { db } from '../../../db/index.js'
import { likes, matches } from '../../../db/schema/matching.js'
import { messages } from '../../../db/schema/messaging.js'
import { users, userPhotos } from '../../../db/schema/users.js'
import { userPrivacySettings } from '../../../db/schema/settings.js'
import { blocks } from '../../../db/schema/safety.js'
import { notifyNewMatch, notifyPassed } from '../../services/notifications/likeNotification.js'
import { attachUsersToMatchRoom } from '../../socket/index.js'
import { assertFeature } from '../../services/entitlementService.js'
import { displayHandle } from '../../utils/handle.js'

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 50
const EARTH_RADIUS_MI = 3958.8
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
    const [ts, id] = decoded.split('|')
    if (!ts || !id) return null
    const date = new Date(ts)
    if (Number.isNaN(date.getTime())) return null
    return { createdAt: date, id }
  } catch {
    return null
  }
}

function encodeCursor(createdAt, id) {
  return Buffer.from(`${new Date(createdAt).toISOString()}|${id}`, 'utf8').toString('base64url')
}

function toNumberOrNull(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function computeDistanceLabel(fromLat, fromLng, toLat, toLng) {
  const lat1 = toNumberOrNull(fromLat)
  const lng1 = toNumberOrNull(fromLng)
  const lat2 = toNumberOrNull(toLat)
  const lng2 = toNumberOrNull(toLng)
  if (lat1 === null || lng1 === null || lat2 === null || lng2 === null) return null

  const toRad = (deg) => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  const miles = EARTH_RADIUS_MI * c
  return `${Math.max(1, Math.round(miles))} mi`
}

function sortPair(user1, user2) {
  return String(user1) < String(user2)
    ? { userAId: user1, userBId: user2 }
    : { userAId: user2, userBId: user1 }
}

async function isOperatedPersona(userId) {
  const [row] = await db
    .select({
      phone: users.phone,
      phoneCountry: users.phoneCountry,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  return Boolean(
    row
      && row.phoneCountry === OPERATED_PHONE_COUNTRY
      && String(row.phone || '').startsWith(OPERATED_PHONE_PREFIX),
  )
}

async function findVisibleInboundLike(userId, fromUserId) {
  const rows = await db
    .select({
      id: likes.id,
      fromUserId: likes.fromUserId,
      toUserId: likes.toUserId,
      type: likes.type,
      matchId: likes.matchId,
    })
    .from(likes)
    .innerJoin(users, eq(users.id, likes.fromUserId))
    .where(
      and(
        eq(likes.toUserId, userId),
        eq(likes.fromUserId, fromUserId),
        inArray(likes.type, ['like', 'super_like']),
        eq(users.isBanned, false),
        eq(users.isPaused, false),
        sql`${users.deletedAt} is null`,
        // TODO: re-enable before going live
        // sql`not exists (
        //   select 1 from ${blocks} b
        //   where (b.blocker_id = ${userId} and b.blocked_id = ${fromUserId})
        //      or (b.blocker_id = ${fromUserId} and b.blocked_id = ${userId})
        // )`,
        sql`not exists (
          select 1 from ${likes} my_swipe
          where my_swipe.from_user_id = ${userId}
            and my_swipe.to_user_id = ${fromUserId}
            and my_swipe.type in ('like', 'super_like', 'pass')
        )`,
      ),
    )
    .limit(1)

  return rows[0] || null
}

export async function getReceivedLikes(req, res) {
  try {
    const userId = req.user.id
    const limit = clampInt(req.query.limit, 1, MAX_LIMIT, DEFAULT_LIMIT)
    const cursor = decodeCursor(req.query.cursor)
    // "Likes You" is now visible to everyone — free users see who liked them
    // (name, age, photo). Liking back is the gated action (enforced in likeBack).
    // `canSeeLikes` here only tells the app whether to allow like-back or paywall.
    const access = await assertFeature(userId, 'canSeeLikes')
    if (!access.ok && access.status !== 403) return res.status(access.status).json(access.body)
    const canLikeBack = access.ok

    const whereParts = [
      eq(likes.toUserId, userId),
      inArray(likes.type, ['like', 'super_like']),
      eq(users.isBanned, false),
      eq(users.isPaused, false),
      sql`${users.deletedAt} is null`,
      // TODO: re-enable before going live
      // sql`not exists (
      //   select 1 from ${blocks} b
      //   where (b.blocker_id = ${userId} and b.blocked_id = ${likes.fromUserId})
      //      or (b.blocker_id = ${likes.fromUserId} and b.blocked_id = ${userId})
      // )`,
      sql`not exists (
        select 1 from ${likes} my_swipe
        where my_swipe.from_user_id = ${userId}
          and my_swipe.to_user_id = ${likes.fromUserId}
          and my_swipe.type in ('like', 'super_like', 'pass')
      )`,
    ]

    if (cursor) {
      whereParts.push(
        sql`(${likes.createdAt} < ${cursor.createdAt} or (${likes.createdAt} = ${cursor.createdAt} and ${likes.id} < ${cursor.id}))`,
      )
    }

    const rows = await db
      .select({
        likeId: likes.id,
        createdAt: likes.createdAt,
        seenAt: likes.seenAt,
        type: likes.type,
        fromUserId: likes.fromUserId,
        handle: users.handle,
        age: users.age,
        pronouns: users.pronouns,
        verified: users.idVerified,
        latApprox: users.latApprox,
        lngApprox: users.lngApprox,
        hideAge: userPrivacySettings.hideAge,
        hideDistance: userPrivacySettings.hideDistance,
        anonymousHandle: userPrivacySettings.anonymousHandle,
        mainPhoto: sql`(
          select ${userPhotos.storageKey}
          from ${userPhotos}
          where ${userPhotos.userId} = ${users.id}
            and ${userPhotos.deletedAt} is null
          order by ${userPhotos.isMain} desc, ${userPhotos.position} asc
          limit 1
        )`,
        mainPhotoIsBlurred: sql`(
          select ${userPhotos.isBlurred}
          from ${userPhotos}
          where ${userPhotos.userId} = ${users.id}
            and ${userPhotos.deletedAt} is null
          order by ${userPhotos.isMain} desc, ${userPhotos.position} asc
          limit 1
        )`,
      })
      .from(likes)
      .innerJoin(users, eq(users.id, likes.fromUserId))
      .leftJoin(userPrivacySettings, eq(userPrivacySettings.userId, users.id))
      .where(and(...whereParts))
      .orderBy(desc(likes.createdAt), desc(likes.id))
      .limit(limit + 1)

    const [countRow] = await db
      .select({
        count: sql`count(*)::int`,
        // Unseen (NEW) inbound likes — drives the "Likes You" badge.
        newCount: sql`count(*) filter (where ${likes.seenAt} is null)::int`,
      })
      .from(likes)
      .innerJoin(users, eq(users.id, likes.fromUserId))
      .where(
        and(
          eq(likes.toUserId, userId),
          inArray(likes.type, ['like', 'super_like']),
          eq(users.isBanned, false),
          eq(users.isPaused, false),
          sql`${users.deletedAt} is null`,
          // TODO: re-enable before going live
          // sql`not exists (
          //   select 1 from ${blocks} b
          //   where (b.blocker_id = ${userId} and b.blocked_id = ${likes.fromUserId})
          //      or (b.blocker_id = ${likes.fromUserId} and b.blocked_id = ${userId})
          // )`,
          sql`not exists (
            select 1 from ${likes} my_swipe
            where my_swipe.from_user_id = ${userId}
              and my_swipe.to_user_id = ${likes.fromUserId}
              and my_swipe.type in ('like', 'super_like', 'pass')
          )`,
        ),
      )

    const hasMore = rows.length > limit
    const sliced = hasMore ? rows.slice(0, limit) : rows
    const [viewerRow] = await db
      .select({
        latApprox: users.latApprox,
        lngApprox: users.lngApprox,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)

    const items = sliced.map((row) => {
      const isSuperLike = row.type === 'super_like'
      const distanceLabel = computeDistanceLabel(
        viewerRow?.latApprox,
        viewerRow?.lngApprox,
        row.latApprox,
        row.lngApprox,
      )
      return {
        fromUserId: row.fromUserId,
        type: row.type,
        superLike: isSuperLike,
        // Everyone sees the real card now. Liking back is the gated action.
        handle: displayHandle(row.handle, { anonymous: row.anonymousHandle }),
        // Privacy keepers: hidden age/distance don't show in the likes sheet.
        age: row.hideAge ? null : row.age,
        pronouns: row.pronouns,
        verified: Boolean(row.verified),
        distanceLabel: row.hideDistance ? null : distanceLabel,
        mainPhoto: row.mainPhoto,
        // Respect the photo's own blur setting. A like never implies photo
        // unlock — that's a per-match property — so a re-like after unmatch
        // must not carry over the previous match's unlocked state.
        blurred: Boolean(row.mainPhotoIsBlurred ?? true),
        // NEW until the viewer opens this liker's profile (clears the badge).
        seen: row.seenAt != null,
        note: isSuperLike ? 'Sent you a Super Like' : null,
      }
    })

    const last = sliced[sliced.length - 1]
    const nextCursor = hasMore && last ? encodeCursor(last.createdAt, last.likeId) : null

    return res.json({
      count: Number(countRow?.count || 0),
      newCount: Number(countRow?.newCount || 0),
      items,
      nextCursor,
      hasMore,
      access: {
        // Free users can SEE who liked them; canSeeLikes now gates liking back.
        canSeeLikes: canLikeBack,
        canLikeBack,
        paywall: canLikeBack ? null : 'plus',
      },
    })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'load_likes_failed', message: 'Failed to load likes' })
  }
}

export async function passLiker(req, res) {
  try {
    // Passing on a liker is free — it just hides them. (Liking back is gated.)
    const userId = req.user.id
    const fromUserId = req.params.fromUserId
    if (!fromUserId) return res.status(400).json({ error: 'invalid_user_id', message: 'Invalid user' })

    const inbound = await findVisibleInboundLike(userId, fromUserId)
    if (!inbound) return res.status(404).json({ error: 'like_not_found', message: 'Like not found' })

    await db
      .insert(likes)
      .values({
        fromUserId: userId,
        toUserId: fromUserId,
        type: 'pass',
        matchId: null,
        seenAt: new Date(),
        createdAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [likes.fromUserId, likes.toUserId],
        set: {
          type: 'pass',
          matchId: null,
          seenAt: new Date(),
          createdAt: new Date(),
        },
      })

    await db
      .update(likes)
      .set({ seenAt: new Date() })
      .where(eq(likes.id, inbound.id))

    notifyPassed(fromUserId, userId)

    return res.json({ ok: true, removed: true })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'pass_liker_failed', message: 'Failed to pass liker' })
  }
}

// Mark an inbound like as SEEN — called when the viewer opens that liker's
// profile. Clears it from the "Likes You" new-like badge. Free + paid.
export async function markLikerSeen(req, res) {
  try {
    const userId = req.user.id
    const fromUserId = req.params.fromUserId
    if (!fromUserId) return res.status(400).json({ error: 'invalid_user_id', message: 'Invalid user' })

    await db
      .update(likes)
      .set({ seenAt: new Date() })
      .where(
        and(
          eq(likes.toUserId, userId),
          eq(likes.fromUserId, fromUserId),
          inArray(likes.type, ['like', 'super_like']),
          sql`${likes.seenAt} is null`,
        ),
      )

    return res.json({ ok: true })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'mark_like_seen_failed', message: 'Failed to mark like seen' })
  }
}

// Mark a match as SEEN by this user — called when they open the matched card
// in "Your Likes". Clears it from the new-match badge. Keyed by the other
// user's id (the app has that, not the matchId).
export async function markMatchSeen(req, res) {
  try {
    const userId = req.user.id
    const otherUserId = req.params.otherUserId
    if (!otherUserId) return res.status(400).json({ error: 'invalid_user_id', message: 'Invalid user' })

    const pair = sortPair(userId, otherUserId)
    const iAmUserA = pair.userAId === userId
    await db
      .update(matches)
      .set(iAmUserA ? { userASeenMatch: true } : { userBSeenMatch: true })
      .where(and(eq(matches.userAId, pair.userAId), eq(matches.userBId, pair.userBId)))

    return res.json({ ok: true })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'mark_match_seen_failed', message: 'Failed to mark match seen' })
  }
}

// Lightweight badge feed: how many NEW likes + NEW matches this user has.
// Used by the app to seed the bottom-nav / tab badges (socket keeps them live).
export async function getLikesActivity(req, res) {
  try {
    const userId = req.user.id

    const [likeRow] = await db
      .select({ newLikes: sql`count(*)::int` })
      .from(likes)
      .innerJoin(users, eq(users.id, likes.fromUserId))
      .where(
        and(
          eq(likes.toUserId, userId),
          inArray(likes.type, ['like', 'super_like']),
          sql`${likes.seenAt} is null`,
          eq(users.isBanned, false),
          eq(users.isPaused, false),
          sql`${users.deletedAt} is null`,
          sql`not exists (
            select 1 from ${likes} my_swipe
            where my_swipe.from_user_id = ${userId}
              and my_swipe.to_user_id = ${likes.fromUserId}
              and my_swipe.type in ('like', 'super_like', 'pass')
          )`,
        ),
      )

    const [matchRow] = await db
      .select({ newMatches: sql`count(*)::int` })
      .from(matches)
      .where(
        and(
          eq(matches.isActive, true),
          or(
            and(eq(matches.userAId, userId), eq(matches.userASeenMatch, false)),
            and(eq(matches.userBId, userId), eq(matches.userBSeenMatch, false)),
          ),
        ),
      )

    // Unread conversations — distinct active matches with ≥1 unread message
    // from the partner. Drives the Messages tab badge WITHOUT loading the list.
    const [chatRow] = await db
      .select({ unreadChats: sql`count(distinct ${messages.matchId})::int` })
      .from(messages)
      .innerJoin(matches, eq(matches.id, messages.matchId))
      .where(
        and(
          eq(matches.isActive, true),
          or(eq(matches.userAId, userId), eq(matches.userBId, userId)),
          sql`${messages.senderId} <> ${userId}`,
          eq(messages.isRead, false),
          isNull(messages.deletedAt),
          sql`(${messages.deletedForUserId} is null or ${messages.deletedForUserId} <> ${userId})`,
        ),
      )

    // Support tickets with an unread admin reply — drives the support badges.
    const supportResult = await db.execute(sql`
      SELECT COUNT(*)::int AS unread_support
      FROM support_tickets t
      WHERE t.requester_user_id = ${userId}
        AND EXISTS (
          SELECT 1 FROM support_ticket_messages m
          WHERE m.ticket_id = t.id
            AND m.author_admin_id IS NOT NULL
            AND m.is_internal = false
            AND m.created_at > COALESCE(t.last_user_read_at, t.created_at)
        )
    `)
    const supportRow = (supportResult.rows || supportResult || [])[0]

    return res.json({
      newLikes: Number(likeRow?.newLikes || 0),
      newMatches: Number(matchRow?.newMatches || 0),
      unreadChats: Number(chatRow?.unreadChats || 0),
      unreadSupport: Number(supportRow?.unread_support || 0),
    })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'load_activity_failed', message: 'Failed to load activity' })
  }
}

export async function getSentLikes(req, res) {
  try {
    const userId = req.user.id
    const limit = clampInt(req.query.limit, 1, MAX_LIMIT, DEFAULT_LIMIT)
    const cursor = decodeCursor(req.query.cursor)

    const baseWhere = [
      eq(likes.fromUserId, userId),
      inArray(likes.type, ['like', 'super_like']),
      eq(users.isBanned, false),
      eq(users.isPaused, false),
      sql`${users.deletedAt} is null`,
      // TODO: re-enable before going live
      // sql`not exists (
      //   select 1 from ${blocks} b
      //   where (b.blocker_id = ${userId} and b.blocked_id = ${likes.toUserId})
      //      or (b.blocker_id = ${likes.toUserId} and b.blocked_id = ${userId})
      // )`,
    ]

    const whereParts = [...baseWhere]
    if (cursor) {
      whereParts.push(
        sql`(${likes.createdAt} < ${cursor.createdAt} or (${likes.createdAt} = ${cursor.createdAt} and ${likes.id} < ${cursor.id}))`,
      )
    }

    const [rows, countRow, viewerRow] = await Promise.all([
      db
        .select({
          likeId: likes.id,
          createdAt: likes.createdAt,
          type: likes.type,
          matchId: likes.matchId,
          // Whether I (the sender) have already opened this matched card.
          myMatchSeen: sql`case when ${matches.userAId} = ${userId}
            then ${matches.userASeenMatch} else ${matches.userBSeenMatch} end`,
          toUserId: likes.toUserId,
          handle: users.handle,
          age: users.age,
          pronouns: users.pronouns,
          verified: users.idVerified,
          latApprox: users.latApprox,
          lngApprox: users.lngApprox,
          hideAge: userPrivacySettings.hideAge,
          hideDistance: userPrivacySettings.hideDistance,
          anonymousHandle: userPrivacySettings.anonymousHandle,
          mainPhoto: sql`(
            select ${userPhotos.storageKey}
            from ${userPhotos}
            where ${userPhotos.userId} = ${users.id}
              and ${userPhotos.deletedAt} is null
            order by ${userPhotos.isMain} desc, ${userPhotos.position} asc
            limit 1
          )`,
          mainPhotoIsBlurred: sql`(
            select ${userPhotos.isBlurred}
            from ${userPhotos}
            where ${userPhotos.userId} = ${users.id}
              and ${userPhotos.deletedAt} is null
            order by ${userPhotos.isMain} desc, ${userPhotos.position} asc
            limit 1
          )`,
          mainPhotoBlurAmount: sql`(
            select ${userPhotos.blurAmount}
            from ${userPhotos}
            where ${userPhotos.userId} = ${users.id}
              and ${userPhotos.deletedAt} is null
            order by ${userPhotos.isMain} desc, ${userPhotos.position} asc
            limit 1
          )`,
        })
        .from(likes)
        .innerJoin(users, eq(users.id, likes.toUserId))
        .leftJoin(matches, eq(matches.id, likes.matchId))
        .leftJoin(userPrivacySettings, eq(userPrivacySettings.userId, users.id))
        .where(and(...whereParts))
        .orderBy(desc(likes.createdAt), desc(likes.id))
        .limit(limit + 1),

      db
        .select({
          count: sql`count(*)::int`,
          // NEW (unseen) matches among my sent likes — drives "Your Likes" badge.
          newMatchCount: sql`count(*) filter (
            where ${likes.matchId} is not null and case when ${matches.userAId} = ${userId}
              then ${matches.userASeenMatch} else ${matches.userBSeenMatch} end = false
          )::int`,
        })
        .from(likes)
        .innerJoin(users, eq(users.id, likes.toUserId))
        .leftJoin(matches, eq(matches.id, likes.matchId))
        .where(and(...baseWhere)),

      db
        .select({ latApprox: users.latApprox, lngApprox: users.lngApprox })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1),
    ])

    const hasMore = rows.length > limit
    const sliced = hasMore ? rows.slice(0, limit) : rows
    const viewer = viewerRow[0]

    const items = sliced.map((row) => ({
      toUserId: row.toUserId,
      type: row.type,
      superLike: row.type === 'super_like',
      handle: displayHandle(row.handle, { anonymous: row.anonymousHandle }),
      // Privacy keepers: hidden age/distance don't show in the likes sheet.
      age: row.hideAge ? null : row.age,
      pronouns: row.pronouns ?? null,
      verified: Boolean(row.verified),
      distanceLabel: row.hideDistance
          ? null
          : computeDistanceLabel(viewer?.latApprox, viewer?.lngApprox, row.latApprox, row.lngApprox),
      mainPhoto: row.mainPhoto ?? null,
      mainPhotoIsBlurred: Boolean(row.mainPhotoIsBlurred),
      mainPhotoBlurAmount: Number(row.mainPhotoBlurAmount ?? 70),
      sentAt: row.createdAt,
      matched: row.matchId != null,
      matchId: row.matchId ?? null,
      // NEW match the sender hasn't opened yet (purple dot + badge).
      isNewMatch: row.matchId != null && row.myMatchSeen === false,
    }))

    const last = sliced[sliced.length - 1]
    const nextCursor = hasMore && last ? encodeCursor(last.createdAt, last.likeId) : null

    return res.json({
      count: Number(countRow[0]?.count || 0),
      newMatchCount: Number(countRow[0]?.newMatchCount || 0),
      items,
      nextCursor,
      hasMore,
    })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'load_sent_likes_failed', message: 'Failed to load sent likes' })
  }
}

export async function unlikeUser(req, res) {
  try {
    const userId = req.user.id
    const toUserId = req.params.toUserId
    if (!toUserId || toUserId === userId) {
      return res.status(400).json({ error: 'invalid_user_id', message: 'Invalid user' })
    }

    const [likeRow] = await db
      .select({ id: likes.id, matchId: likes.matchId })
      .from(likes)
      .where(and(eq(likes.fromUserId, userId), eq(likes.toUserId, toUserId)))
      .limit(1)

    if (!likeRow) return res.status(404).json({ error: 'like_not_found', message: 'Like not found' })

    if (likeRow.matchId) {
      await db
        .update(matches)
        .set({ isActive: false, unmatchedAt: new Date(), unmatchedByUserId: userId, updatedAt: new Date() })
        .where(eq(matches.id, likeRow.matchId))
    }

    await db
      .delete(likes)
      .where(and(eq(likes.fromUserId, userId), eq(likes.toUserId, toUserId)))

    return res.json({ ok: true })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'unlike_failed', message: 'Failed to unlike' })
  }
}

export async function likeBack(req, res) {
  try {
    const userId = req.user.id
    const access = await assertFeature(userId, 'canSeeLikes')
    if (!access.ok) {
      // Operated personas are internal QA/admin test accounts. They should be
      // able to like back from the operated dashboard even without a paid sub.
      const bypassAllowed = access.status === 403 && await isOperatedPersona(userId)
      if (!bypassAllowed) return res.status(access.status).json(access.body)
    }

    const fromUserId = req.params.fromUserId
    if (!fromUserId) return res.status(400).json({ error: 'invalid_user_id', message: 'Invalid user' })
    if (fromUserId === userId) return res.status(400).json({ error: 'cannot_like_self', message: 'Cannot like yourself' })

    const inbound = await findVisibleInboundLike(userId, fromUserId)
    if (!inbound) return res.status(404).json({ error: 'like_not_found', message: 'Like not found' })

    const reciprocalType = inbound.type === 'super_like' ? 'super_like' : 'like'
    await db
      .insert(likes)
      .values({
        fromUserId: userId,
        toUserId: fromUserId,
        type: reciprocalType,
        matchId: null,
        seenAt: new Date(),
        createdAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [likes.fromUserId, likes.toUserId],
        set: {
          type: reciprocalType,
          matchId: null,
          seenAt: new Date(),
          createdAt: new Date(),
        },
      })

    const pair = sortPair(userId, fromUserId)
    const [matchRow] = await db
      .insert(matches)
      .values({
        userAId: pair.userAId,
        userBId: pair.userBId,
        isActive: true,
        unmatchedAt: null,
        unmatchedByUserId: null,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [matches.userAId, matches.userBId],
        set: {
          isActive: true,
          unmatchedAt: null,
          unmatchedByUserId: null,
          updatedAt: new Date(),
        },
      })
      .returning({ id: matches.id })

    await db
      .update(likes)
      .set({ matchId: matchRow.id, seenAt: new Date() })
      .where(
        sql`(${likes.fromUserId} = ${userId} and ${likes.toUserId} = ${fromUserId})
             or (${likes.fromUserId} = ${fromUserId} and ${likes.toUserId} = ${userId})`,
      )

    // The like-back initiator (this user) is already aware of the match — mark
    // their side seen so only the OTHER person gets the new-match badge.
    await db
      .update(matches)
      .set(pair.userAId === userId ? { userASeenMatch: true } : { userBSeenMatch: true })
      .where(eq(matches.id, matchRow.id))

    // Only the OTHER person is notified. The like-back initiator (this user)
    // caused the match and is already on the match screen, so pushing them an
    // "It's a Match!" notification is redundant/confusing — skip it.
    notifyNewMatch(fromUserId, userId)
    try {
      await attachUsersToMatchRoom([userId, fromUserId], matchRow.id)
    } catch (err) {
      console.error('attachUsersToMatchRoom failed:', err.message)
    }

    return res.json({ ok: true, matched: true, matchId: matchRow.id })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'like_back_failed', message: 'Failed to like back' })
  }
}
