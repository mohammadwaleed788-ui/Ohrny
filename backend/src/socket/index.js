import { Server } from 'socket.io'
import { and, eq, isNull, or, sql } from 'drizzle-orm'
import { socketAuthMiddleware } from './auth.js'
import { db } from '../../db/index.js'
import { matches } from '../../db/schema/matching.js'
import { messages } from '../../db/schema/messaging.js'
import { users } from '../../db/schema/users.js'
import { notifyNewMessage, notifyPhotoUnlockRequest } from '../services/notifications/chatNotification.js'

let io = null
const FREE_MESSAGE_LIMIT = 10

export function getIO() {
  return io
}

export async function attachUsersToMatchRoom(userIds, matchId, options = {}) {
  if (!io || !matchId || !Array.isArray(userIds)) return
  const emitMatchNew = options.emitMatchNew ?? true

  for (const userId of userIds) {
    const sockets = await io.in(`user:${userId}`).fetchSockets()
    for (const socket of sockets) {
      socket.join(`match:${matchId}`)
    }
    if (emitMatchNew) {
      io.to(`user:${userId}`).emit('match:new', { matchId })
    }
  }
}

export async function isUserReadingMatch(userId, matchId) {
  if (!io || !userId || !matchId) return false

  const sockets = await io.in(`user:${userId}`).fetchSockets()
  return sockets.some((socket) => socket.data?.activeMatchId === matchId)
}

async function joinSocketToMatchIfMember(socket, matchId) {
  if (!matchId) return false

  const [match] = await db
    .select({ userAId: matches.userAId, userBId: matches.userBId })
    .from(matches)
    .where(and(eq(matches.id, matchId), eq(matches.isActive, true)))
    .limit(1)

  if (!match) return false
  if (match.userAId !== socket.userId && match.userBId !== socket.userId) {
    return false
  }

  socket.join(`match:${matchId}`)
  return true
}

export function initSocket(server) {
  io = new Server(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
    pingInterval: 25000,
    pingTimeout: 20000,
  })

  io.use(socketAuthMiddleware)

  io.on('connection', async (socket) => {
    const userId = socket.userId

    // Join rooms for all active matches
    try {
      const userMatches = await db
        .select({ id: matches.id })
        .from(matches)
        .where(
          and(
            or(eq(matches.userAId, userId), eq(matches.userBId, userId)),
            eq(matches.isActive, true),
          ),
        )

      for (const m of userMatches) {
        socket.join(`match:${m.id}`)
      }

      socket.join(`user:${userId}`)
    } catch (err) {
      console.error('Socket room join error:', err.message)
    }

    socket.on('chat:open', async (data, ack) => {
      try {
        const { matchId } = data || {}
        const ok = await joinSocketToMatchIfMember(socket, matchId)
        if (ok) socket.data.activeMatchId = matchId
        ack?.({ ok })
      } catch (err) {
        console.error('chat:open error:', err.message)
        ack?.({ ok: false })
      }
    })

    socket.on('chat:close', (data, ack) => {
      const { matchId } = data || {}
      if (!matchId || socket.data.activeMatchId === matchId) {
        socket.data.activeMatchId = null
      }
      ack?.({ ok: true })
    })

    // ── message:send ──────────────────────────────────────────
    socket.on('message:send', async (data, ack) => {
      try {
        const { matchId, content } = data || {}
        if (!matchId || !content?.trim()) {
          return ack?.({ error: 'matchId and content are required' })
        }

        const [match] = await db
          .select()
          .from(matches)
          .where(and(eq(matches.id, matchId), eq(matches.isActive, true)))
          .limit(1)

        if (!match) return ack?.({ error: 'Match not found' })

        const isUserA = match.userAId === userId
        const isUserB = match.userBId === userId
        if (!isUserA && !isUserB) return ack?.({ error: 'Not in this match' })

        const recipientId = isUserA ? match.userBId : match.userAId

        // Free-tier gating
        const [sender] = await db
          .select({ plan: users.plan, iam: users.iam })
          .from(users)
          .where(eq(users.id, userId))
          .limit(1)

        const isWoman = sender?.iam === 'woman'
        const isFree = !sender || sender.plan === 'free'
        const myMsgCount = await getVisibleSentMessageCount(matchId, userId)

        // Women have unlimited messaging regardless of plan
        if (isFree && !isWoman) {
          if (myMsgCount >= FREE_MESSAGE_LIMIT) {
            return ack?.({ error: 'message_limit', paywall: 'messages' })
          }

          if (myMsgCount === 0) {
            const { startedCount } = await getStartedChatCount(userId)
            if (startedCount >= 4) {
              return ack?.({ error: 'chat_limit', paywall: 'matches' })
            }
          }
        }

        const now = new Date()
        // Ephemeral only for Plus users; free users get permanent messages
        const isEphemeral = !isFree
        const expiresAt = isEphemeral
          ? new Date(now.getTime() + 24 * 60 * 60 * 1000)
          : null

        const [msg] = await db
          .insert(messages)
          .values({
            matchId,
            senderId: userId,
            content: content.trim(),
            isEphemeral,
            expiresAt,
            createdAt: now,
          })
          .returning()

        const countField = isUserA ? { messageCountUserA: myMsgCount + 1 } : { messageCountUserB: myMsgCount + 1 }
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
        }

        await attachUsersToMatchRoom([userId, recipientId], matchId, { emitMatchNew: false })
        io.to(`match:${matchId}`).emit('message:new', outMsg)
        ack?.({ ok: true, message: outMsg })

        // Push unless the recipient is actively reading this exact chat.
        if (!(await isUserReadingMatch(recipientId, matchId))) {
          notifyNewMessage(recipientId, socket.userHandle, matchId)
        }
      } catch (err) {
        console.error('message:send error:', err.message)
        ack?.({ error: 'Failed to send message' })
      }
    })

    // ── message:typing ────────────────────────────────────────
    socket.on('message:typing', (data) => {
      const { matchId } = data || {}
      if (!matchId) return
      socket.to(`match:${matchId}`).emit('message:typing', {
        matchId,
        userId,
        handle: socket.userHandle,
      })
    })

    // ── message:read ──────────────────────────────────────────
    socket.on('message:read', async (data, ack) => {
      try {
        const { matchId } = data || {}
        if (!matchId) return ack?.({ error: 'matchId is required' })

        // Determine the partner's id so we only mark their messages as read
        const [match] = await db
          .select({ userAId: matches.userAId, userBId: matches.userBId })
          .from(matches)
          .where(and(eq(matches.id, matchId), eq(matches.isActive, true)))
          .limit(1)

        if (!match) return ack?.({ error: 'Match not found' })
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

        io.to(`match:${matchId}`).emit('message:read', { matchId, readBy: userId })
        ack?.({ ok: true })
      } catch (err) {
        console.error('message:read error:', err.message)
        ack?.({ error: 'Failed to mark as read' })
      }
    })

    // ── unlock:request ────────────────────────────────────────
    socket.on('unlock:request', async (data, ack) => {
      try {
        const { matchId } = data || {}
        if (!matchId) return ack?.({ error: 'matchId is required' })

        const [match] = await db
          .select()
          .from(matches)
          .where(and(eq(matches.id, matchId), eq(matches.isActive, true)))
          .limit(1)

        if (!match) return ack?.({ error: 'Match not found' })

        const isUserA = match.userAId === userId
        const isUserB = match.userBId === userId
        if (!isUserA && !isUserB) return ack?.({ error: 'Not in this match' })

        const recipientId = isUserA ? match.userBId : match.userAId
        const updates = {}
        if (isUserA) updates.userAUnlockRequested = true
        else updates.userBUnlockRequested = true

        const otherRequested = isUserA ? match.userBUnlockRequested : match.userAUnlockRequested
        if (otherRequested) {
          updates.photosUnlocked = true
          updates.photosUnlockedAt = new Date()
        }

        updates.updatedAt = new Date()

        await db.update(matches).set(updates).where(eq(matches.id, matchId))

        if (updates.photosUnlocked) {
          io.to(`match:${matchId}`).emit('unlock:complete', { matchId })
        } else {
          io.to(`match:${matchId}`).emit('unlock:requested', { matchId, requestedBy: userId })
          notifyPhotoUnlockRequest(recipientId, socket.userHandle)
        }

        ack?.({ ok: true, unlocked: !!updates.photosUnlocked })
      } catch (err) {
        console.error('unlock:request error:', err.message)
        ack?.({ error: 'Failed to request unlock' })
      }
    })

    // ── call:signal ───────────────────────────────────────────
    socket.on('call:signal', (data) => {
      const { matchId, signal } = data || {}
      if (!matchId || !signal) return
      socket.to(`match:${matchId}`).emit('call:signal', {
        matchId,
        senderId: userId,
        signal,
      })
    })

    socket.on('disconnect', () => {
      // Cleanup handled automatically by Socket.IO room leave
    })
  })

  return io
}

async function getStartedChatCount(userId) {
  const rows = await db
    .selectDistinct({ matchId: messages.matchId })
    .from(messages)
    .where(eq(messages.senderId, userId))

  return { startedCount: rows.length }
}

async function getVisibleSentMessageCount(matchId, userId) {
  const [row] = await db
    .select({ count: sql`count(*)::int` })
    .from(messages)
    .where(
      and(
        eq(messages.matchId, matchId),
        eq(messages.senderId, userId),
        isNull(messages.deletedAt),
      ),
    )

  return Number(row?.count || 0)
}
