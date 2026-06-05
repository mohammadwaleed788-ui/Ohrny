import { Server } from 'socket.io'
import { and, eq, or } from 'drizzle-orm'
import { socketAuthMiddleware } from './auth.js'
import { db } from '../../db/index.js'
import { matches } from '../../db/schema/matching.js'
import { calls, messages } from '../../db/schema/messaging.js'
import { notifyNewMessage, notifyPhotoUnlockRequest } from '../services/notifications/chatNotification.js'
import { assertCanMessage, assertFeature, getEffectiveEntitlements } from '../services/entitlementService.js'

let io = null

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

function isTerminalCallStatus(status) {
  return status === 'ended' || status === 'declined' || status === 'missed'
}

async function getSocketCall(callId, matchId, userId) {
  if (!callId || !matchId || !userId) return null

  const [call] = await db
    .select()
    .from(calls)
    .where(and(eq(calls.id, callId), eq(calls.matchId, matchId)))
    .limit(1)

  if (!call) return null
  if (call.callerId !== userId && call.calleeId !== userId) return null
  return call
}

async function endActiveCallForDisconnectedSocket(socket) {
  const activeCall = socket.data?.activeCall
  if (!activeCall?.callId || !activeCall?.matchId) return

  socket.data.activeCall = null

  try {
    const call = await getSocketCall(activeCall.callId, activeCall.matchId, socket.userId)
    if (!call || isTerminalCallStatus(call.status)) return

    const now = new Date()
    const updates = {
      status: 'ended',
      endedAt: now,
    }

    if (call.startedAt) {
      updates.durationSeconds = Math.round((now.getTime() - new Date(call.startedAt).getTime()) / 1000)
    }

    const [updated] = await db
      .update(calls)
      .set(updates)
      .where(and(eq(calls.id, call.id), eq(calls.status, call.status)))
      .returning()

    if (!updated) return

    const otherId = call.callerId === socket.userId ? call.calleeId : call.callerId
    io.to(`user:${otherId}`).emit('call:status', {
      callId: call.id,
      matchId: call.matchId,
      status: 'ended',
      updatedBy: socket.userId,
      reason: 'disconnected',
    })
  } catch (err) {
    console.error('call disconnect cleanup error:', err.message)
  }
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

        const access = await assertCanMessage(userId, matchId)
        if (!access.ok) return ack?.(access.body)

        const now = new Date()
        const entitlements = access.entitlements || await getEffectiveEntitlements(userId)
        const isEphemeral = entitlements?.plan !== 'free'
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

        const countField = isUserA
          ? { messageCountUserA: access.myMessageCount + 1 }
          : { messageCountUserB: access.myMessageCount + 1 }
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

        const senderAccess = await assertFeature(partnerId, 'readReceipts')
        if (senderAccess.ok) {
          io.to(`user:${partnerId}`).emit('message:read', { matchId, readBy: userId })
        }
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

    // ── call:join — mark this socket as actively participating in a call ──
    socket.on('call:join', async (data, ack) => {
      try {
        const { callId, matchId } = data || {}
        const call = await getSocketCall(callId, matchId, userId)
        if (!call || isTerminalCallStatus(call.status)) {
          return ack?.({ ok: false, error: 'Call not found' })
        }

        socket.join(`match:${matchId}`)
        socket.data.activeCall = { callId, matchId }
        ack?.({ ok: true })
      } catch (err) {
        console.error('call:join error:', err.message)
        ack?.({ ok: false, error: 'Failed to join call' })
      }
    })

    // ── call:leave — clear active-call tracking after graceful teardown ──
    socket.on('call:leave', (data, ack) => {
      const { callId, matchId } = data || {}
      const activeCall = socket.data?.activeCall
      if (
        activeCall &&
        (!callId || activeCall.callId === callId) &&
        (!matchId || activeCall.matchId === matchId)
      ) {
        socket.data.activeCall = null
      }
      ack?.({ ok: true })
    })

    // ── call:ringing — callee tells the caller their phone is now ringing ──
    socket.on('call:ringing', (data) => {
      const { matchId } = data || {}
      if (!matchId) return
      socket.to(`match:${matchId}`).emit('call:ringing', { senderId: userId })
    })

    // ── call:media — relay full media state (mute/camera/mask) to the other ──
    socket.on('call:media', (data) => {
      const { matchId, muted, camOff, masked } = data || {}
      if (!matchId) return
      // socket.to() excludes the sender — only the other user in the match receives this
      socket.to(`match:${matchId}`).emit('call:media', {
        senderId: userId,
        muted: !!muted,
        camOff: !!camOff,
        masked: !!masked,
      })
    })

    socket.on('disconnect', () => {
      endActiveCallForDisconnectedSocket(socket)
    })
  })

  return io
}