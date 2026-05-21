import { and, asc, desc, eq, or, sql, isNull, inArray } from 'drizzle-orm'
import { db } from '../../../db/index.js'
import { likes, matches } from '../../../db/schema/matching.js'
import { messages } from '../../../db/schema/messaging.js'
import { users, userPhotos, userPrompts, userInterests, userLifestyle } from '../../../db/schema/users.js'
import { blocks } from '../../../db/schema/safety.js'
import { getIO } from '../../socket/index.js'
import { notifyNewMessage, notifyPhotoUnlockRequest } from '../../services/notifications/chatNotification.js'

const DEFAULT_LIMIT = 30
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

// ── GET /user/matches ─────────────────────────────────────────
export async function getMatches(req, res) {
  try {
    const userId = req.user.id

    const rows = await db
      .select({
        matchId: matches.id,
        userAId: matches.userAId,
        userBId: matches.userBId,
        matchedAt: matches.matchedAt,
        photosUnlocked: matches.photosUnlocked,
        photosUnlockedAt: matches.photosUnlockedAt,
        userAUnlockRequested: matches.userAUnlockRequested,
        userBUnlockRequested: matches.userBUnlockRequested,
        messageCountUserA: matches.messageCountUserA,
        messageCountUserB: matches.messageCountUserB,
        updatedAt: matches.updatedAt,
      })
      .from(matches)
      .where(
        and(
          or(eq(matches.userAId, userId), eq(matches.userBId, userId)),
          eq(matches.isActive, true),
        ),
      )
      .orderBy(desc(matches.updatedAt))

    const matchList = await Promise.all(
      rows.map(async (row) => {
        const isUserA = row.userAId === userId
        const partnerId = isUserA ? row.userBId : row.userAId

        // Fetch partner info
        const [partner] = await db
          .select({
            handle: users.handle,
            age: users.age,
            verified: users.idVerified,
          })
          .from(users)
          .where(eq(users.id, partnerId))
          .limit(1)

        // Fetch partner main photo
        const [photo] = await db
          .select({ storageKey: userPhotos.storageKey, blurAmount: userPhotos.blurAmount })
          .from(userPhotos)
          .where(
            and(
              eq(userPhotos.userId, partnerId),
              eq(userPhotos.isMain, true),
              isNull(userPhotos.deletedAt),
            ),
          )
          .limit(1)

        // Fetch last message
        const [lastMsg] = await db
          .select({
            id: messages.id,
            senderId: messages.senderId,
            content: messages.content,
            createdAt: messages.createdAt,
          })
          .from(messages)
          .where(and(eq(messages.matchId, row.matchId), isNull(messages.deletedAt)))
          .orderBy(desc(messages.createdAt))
          .limit(1)

        // Count unread messages (sent by partner, not read by me)
        const [unreadRow] = await db
          .select({ count: sql`count(*)::int` })
          .from(messages)
          .where(
            and(
              eq(messages.matchId, row.matchId),
              eq(messages.senderId, partnerId),
              eq(messages.isRead, false),
              isNull(messages.deletedAt),
            ),
          )

        return {
          matchId: row.matchId,
          matchedAt: row.matchedAt,
          updatedAt: row.updatedAt,
          photosUnlocked: row.photosUnlocked,
          unlockRequested: isUserA ? row.userAUnlockRequested : row.userBUnlockRequested,
          partnerUnlockRequested: isUserA ? row.userBUnlockRequested : row.userAUnlockRequested,
          myMessageCount: isUserA ? row.messageCountUserA : row.messageCountUserB,
          partner: {
            id: partnerId,
            handle: partner?.handle ?? null,
            age: partner?.age ?? null,
            verified: Boolean(partner?.verified),
            mainPhoto: photo?.storageKey ?? null,
            blurAmount: photo?.blurAmount ?? 70,
          },
          lastMessage: lastMsg
            ? {
                id: lastMsg.id,
                senderId: lastMsg.senderId,
                content: lastMsg.content,
                createdAt: lastMsg.createdAt,
                fromMe: lastMsg.senderId === userId,
              }
            : null,
          unreadCount: Number(unreadRow?.count || 0),
        }
      }),
    )

    return res.json({ matches: matchList })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Failed to load matches' })
  }
}

// ── GET /user/matches/:matchId/messages ───────────────────────
export async function getMessages(req, res) {
  try {
    const userId = req.user.id
    const { matchId } = req.params
    const limit = clampInt(req.query.limit, 1, MAX_LIMIT, DEFAULT_LIMIT)
    const cursor = decodeCursor(req.query.cursor)

    // Verify user belongs to this match
    const [match] = await db
      .select({ userAId: matches.userAId, userBId: matches.userBId })
      .from(matches)
      .where(and(eq(matches.id, matchId), eq(matches.isActive, true)))
      .limit(1)

    if (!match) return res.status(404).json({ error: 'Match not found' })
    if (match.userAId !== userId && match.userBId !== userId) {
      return res.status(403).json({ error: 'Not in this match' })
    }

    const whereParts = [eq(messages.matchId, matchId), isNull(messages.deletedAt)]
    if (cursor) {
      whereParts.push(
        sql`(${messages.createdAt} < ${cursor.createdAt} OR (${messages.createdAt} = ${cursor.createdAt} AND ${messages.id} < ${cursor.id}))`,
      )
    }

    const rows = await db
      .select({
        id: messages.id,
        senderId: messages.senderId,
        content: messages.content,
        isRead: messages.isRead,
        readAt: messages.readAt,
        isEphemeral: messages.isEphemeral,
        expiresAt: messages.expiresAt,
        createdAt: messages.createdAt,
      })
      .from(messages)
      .where(and(...whereParts))
      .orderBy(desc(messages.createdAt), desc(messages.id))
      .limit(limit + 1)

    const hasMore = rows.length > limit
    const sliced = hasMore ? rows.slice(0, limit) : rows
    const last = sliced[sliced.length - 1]
    const nextCursor = hasMore && last ? encodeCursor(last.createdAt, last.id) : null

    return res.json({
      messages: sliced.map((m) => ({
        ...m,
        fromMe: m.senderId === userId,
      })),
      nextCursor,
      hasMore,
    })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Failed to load messages' })
  }
}

// ── POST /user/matches/:matchId/messages ──────────────────────
export async function sendMessage(req, res) {
  try {
    const userId = req.user.id
    const { matchId } = req.params
    const { content } = req.body || {}

    if (!content?.trim()) {
      return res.status(400).json({ error: 'Content is required' })
    }

    const [match] = await db
      .select()
      .from(matches)
      .where(and(eq(matches.id, matchId), eq(matches.isActive, true)))
      .limit(1)

    if (!match) return res.status(404).json({ error: 'Match not found' })

    const isUserA = match.userAId === userId
    const isUserB = match.userBId === userId
    if (!isUserA && !isUserB) {
      return res.status(403).json({ error: 'Not in this match' })
    }

    const recipientId = isUserA ? match.userBId : match.userAId

    // Free-tier gating
    const [sender] = await db
      .select({ plan: users.plan })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)

    const isFree = !sender || sender.plan === 'free'

    if (isFree) {
      const myMsgCount = isUserA ? match.messageCountUserA : match.messageCountUserB
      if (myMsgCount >= 10) {
        return res.status(403).json({ error: 'message_limit', paywall: 'messages' })
      }

      if (myMsgCount === 0) {
        const startedCount = await getStartedChatCount(userId)
        if (startedCount >= 4) {
          return res.status(403).json({ error: 'chat_limit', paywall: 'matches' })
        }
      }
    }

    const now = new Date()
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000)

    const [msg] = await db
      .insert(messages)
      .values({
        matchId,
        senderId: userId,
        content: content.trim(),
        isEphemeral: true,
        expiresAt,
        createdAt: now,
      })
      .returning()

    const countField = isUserA
      ? { messageCountUserA: match.messageCountUserA + 1 }
      : { messageCountUserB: match.messageCountUserB + 1 }

    await db
      .update(matches)
      .set({ ...countField, updatedAt: now })
      .where(eq(matches.id, matchId))

    const outMsg = {
      id: msg.id,
      matchId: msg.matchId,
      senderId: msg.senderId,
      content: msg.content,
      isEphemeral: msg.isEphemeral,
      expiresAt: msg.expiresAt,
      createdAt: msg.createdAt,
      fromMe: true,
    }

    // Broadcast via Socket.IO
    const io = getIO()
    if (io) {
      io.to(`match:${matchId}`).emit('message:new', outMsg)

      const recipientSockets = await io.in(`user:${recipientId}`).fetchSockets()
      if (recipientSockets.length === 0) {
        notifyNewMessage(recipientId, req.user.handle, matchId)
      }
    } else {
      notifyNewMessage(recipientId, req.user.handle, matchId)
    }

    return res.json({ ok: true, message: outMsg })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Failed to send message' })
  }
}

// ── PATCH /user/matches/:matchId/read ─────────────────────────
export async function markRead(req, res) {
  try {
    const userId = req.user.id
    const { matchId } = req.params

    const [match] = await db
      .select({ userAId: matches.userAId, userBId: matches.userBId })
      .from(matches)
      .where(and(eq(matches.id, matchId), eq(matches.isActive, true)))
      .limit(1)

    if (!match) return res.status(404).json({ error: 'Match not found' })
    if (match.userAId !== userId && match.userBId !== userId) {
      return res.status(403).json({ error: 'Not in this match' })
    }

    const partnerId = match.userAId === userId ? match.userBId : match.userAId
    const now = new Date()

    await db
      .update(messages)
      .set({ isRead: true, readAt: now })
      .where(
        and(
          eq(messages.matchId, matchId),
          eq(messages.senderId, partnerId),
          eq(messages.isRead, false),
        ),
      )

    const io = getIO()
    if (io) {
      io.to(`match:${matchId}`).emit('message:read', { matchId, readBy: userId })
    }

    return res.json({ ok: true })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Failed to mark messages as read' })
  }
}

// ── POST /user/matches/:matchId/unlock ────────────────────────
export async function requestUnlock(req, res) {
  try {
    const userId = req.user.id
    const { matchId } = req.params

    const [match] = await db
      .select()
      .from(matches)
      .where(and(eq(matches.id, matchId), eq(matches.isActive, true)))
      .limit(1)

    if (!match) return res.status(404).json({ error: 'Match not found' })

    const isUserA = match.userAId === userId
    const isUserB = match.userBId === userId
    if (!isUserA && !isUserB) {
      return res.status(403).json({ error: 'Not in this match' })
    }

    if (match.photosUnlocked) {
      return res.json({ ok: true, unlocked: true, alreadyUnlocked: true })
    }

    const recipientId = isUserA ? match.userBId : match.userAId
    const updates = { updatedAt: new Date() }

    if (isUserA) updates.userAUnlockRequested = true
    else updates.userBUnlockRequested = true

    const otherRequested = isUserA ? match.userBUnlockRequested : match.userAUnlockRequested
    if (otherRequested) {
      updates.photosUnlocked = true
      updates.photosUnlockedAt = new Date()
    }

    await db.update(matches).set(updates).where(eq(matches.id, matchId))

    const io = getIO()
    if (io) {
      if (updates.photosUnlocked) {
        io.to(`match:${matchId}`).emit('unlock:complete', { matchId })
      } else {
        io.to(`match:${matchId}`).emit('unlock:requested', { matchId, requestedBy: userId })
        notifyPhotoUnlockRequest(recipientId, req.user.handle, matchId)
      }
    } else if (!updates.photosUnlocked) {
      notifyPhotoUnlockRequest(recipientId, req.user.handle, matchId)
    }

    return res.json({ ok: true, unlocked: !!updates.photosUnlocked })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Failed to request unlock' })
  }
}

// ── DELETE /user/matches/:matchId ─────────────────────────────
export async function unmatch(req, res) {
  try {
    const userId = req.user.id
    const { matchId } = req.params

    const [match] = await db
      .select({ userAId: matches.userAId, userBId: matches.userBId })
      .from(matches)
      .where(and(eq(matches.id, matchId), eq(matches.isActive, true)))
      .limit(1)

    if (!match) return res.status(404).json({ error: 'Match not found' })
    if (match.userAId !== userId && match.userBId !== userId) {
      return res.status(403).json({ error: 'Not in this match' })
    }

    const partnerId = match.userAId === userId ? match.userBId : match.userAId

    await db
      .update(matches)
      .set({
        isActive: false,
        unmatchedAt: new Date(),
        unmatchedByUserId: userId,
        updatedAt: new Date(),
      })
      .where(eq(matches.id, matchId))

    // Soft-delete all messages in the match
    await db
      .update(messages)
      .set({ deletedAt: new Date() })
      .where(and(eq(messages.matchId, matchId), isNull(messages.deletedAt)))

    // Delete both like rows so both users can see each other in discovery again
    await db
      .delete(likes)
      .where(
        or(
          and(eq(likes.fromUserId, userId), eq(likes.toUserId, partnerId)),
          and(eq(likes.fromUserId, partnerId), eq(likes.toUserId, userId)),
        ),
      )

    // Notify the partner's connected clients so their chat list updates immediately
    const io = getIO()
    if (io) {
      io.to(`user:${partnerId}`).emit('match:removed', { matchId })
    }

    return res.json({ ok: true })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Failed to unmatch' })
  }
}

// ── DELETE /user/matches/:matchId/messages/:messageId ─────────
export async function deleteMessage(req, res) {
  try {
    const userId = req.user.id
    const { matchId, messageId } = req.params

    // Verify message exists, belongs to this match, and was sent by this user
    const [msg] = await db
      .select({ id: messages.id, senderId: messages.senderId, deletedAt: messages.deletedAt })
      .from(messages)
      .where(and(eq(messages.id, messageId), eq(messages.matchId, matchId)))
      .limit(1)

    if (!msg) return res.status(404).json({ error: 'Message not found' })
    if (msg.senderId !== userId) return res.status(403).json({ error: 'Not your message' })
    if (msg.deletedAt) return res.status(410).json({ error: 'Already deleted' })

    // Fetch match to get current message counts and verify membership
    const [match] = await db
      .select()
      .from(matches)
      .where(and(eq(matches.id, matchId), eq(matches.isActive, true)))
      .limit(1)

    if (!match) return res.status(404).json({ error: 'Match not found' })

    const isUserA = match.userAId === userId
    if (!isUserA && match.userBId !== userId) {
      return res.status(403).json({ error: 'Not in this match' })
    }

    // Soft-delete the message
    await db
      .update(messages)
      .set({ deletedAt: new Date() })
      .where(eq(messages.id, messageId))

    // Decrement sender's message count (never below 0) to restore free-tier credit
    const currentCount = isUserA ? match.messageCountUserA : match.messageCountUserB
    const newCount = Math.max(0, currentCount - 1)
    const countField = isUserA
      ? { messageCountUserA: newCount }
      : { messageCountUserB: newCount }

    await db
      .update(matches)
      .set({ ...countField, updatedAt: new Date() })
      .where(eq(matches.id, matchId))

    // Broadcast so both screens remove the bubble instantly
    const io = getIO()
    if (io) {
      io.to(`match:${matchId}`).emit('message:deleted', {
        matchId,
        messageId,
        deletedBy: userId,
      })
    }

    return res.json({ ok: true })
  } catch (err) {
    console.error('deleteMessage error:', err.message)
    return res.status(500).json({ error: 'Failed to delete message' })
  }
}

// ── GET /user/matches/:matchId/partner-profile ────────────────
export async function getPartnerProfile(req, res) {
  try {
    const userId = req.user.id
    const { matchId } = req.params

    // Verify match exists and user is a member
    const [match] = await db
      .select({
        userAId: matches.userAId,
        userBId: matches.userBId,
        photosUnlocked: matches.photosUnlocked,
      })
      .from(matches)
      .where(
        and(
          eq(matches.id, matchId),
          eq(matches.isActive, true),
          or(eq(matches.userAId, userId), eq(matches.userBId, userId)),
        ),
      )
      .limit(1)

    if (!match) return res.status(404).json({ error: 'Match not found' })

    const partnerId = match.userAId === userId ? match.userBId : match.userAId

    // Fetch partner's base profile row
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
      .where(eq(users.id, partnerId))
      .limit(1)

    if (!row || row.isBanned || row.isPaused || row.deletedAt) {
      return res.status(404).json({ error: 'User not found' })
    }

    // Batch fetch everything else in parallel
    const [viewerRow, allPhotos, allPrompts, allInterests, allLifestyles] = await Promise.all([
      db.select({ latApprox: users.latApprox, lngApprox: users.lngApprox })
        .from(users).where(eq(users.id, userId)).limit(1),
      db.select().from(userPhotos)
        .where(and(eq(userPhotos.userId, partnerId), isNull(userPhotos.deletedAt)))
        .orderBy(desc(userPhotos.isMain), asc(userPhotos.position)),
      db.select().from(userPrompts)
        .where(eq(userPrompts.userId, partnerId))
        .orderBy(asc(userPrompts.position)),
      db.select().from(userInterests)
        .where(eq(userInterests.userId, partnerId))
        .orderBy(asc(userInterests.position)),
      db.select().from(userLifestyle)
        .where(eq(userLifestyle.userId, partnerId)),
    ])

    // Distance calculation
    const toNum = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null }
    const viewer = viewerRow[0]
    const vLatN = toNum(viewer?.latApprox), vLngN = toNum(viewer?.lngApprox)
    const rLatN = toNum(row.latApprox),     rLngN = toNum(row.lngApprox)
    let distanceMiles = null, distanceLabel = null
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

    // If photos are unlocked, strip blur so Flutter shows clear photos
    const photos = allPhotos.slice(0, 6).map((p) => ({
      id: p.id,
      storageKey: p.storageKey,
      position: p.position,
      isMain: p.isMain,
      isBlurred: match.photosUnlocked ? false : p.isBlurred,
      blurAmount: match.photosUnlocked ? 0 : p.blurAmount,
    }))

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
      photos,
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
    console.error('getPartnerProfile error:', err.message)
    return res.status(500).json({ error: 'Failed to load profile' })
  }
}

async function getStartedChatCount(userId) {
  const rows = await db
    .selectDistinct({ matchId: messages.matchId })
    .from(messages)
    .where(eq(messages.senderId, userId))

  return rows.length
}
