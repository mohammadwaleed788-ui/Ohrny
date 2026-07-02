import { Server } from 'socket.io'
import { and, eq, isNull, or, sql } from 'drizzle-orm'
import { socketAuthMiddleware } from './auth.js'
import { adminSocketAuthMiddleware } from './adminAuth.js'
import { db } from '../../db/index.js'
import { matches } from '../../db/schema/matching.js'
import { calls, messages } from '../../db/schema/messaging.js'
import { users } from '../../db/schema/users.js'
import { supportTickets } from '../../db/schema/support.js'
import { notifyNewMessage, notifyPhotoUnlockRequest } from '../services/notifications/chatNotification.js'
import { assertCanMessage, assertFeature, getEffectiveEntitlements } from '../services/entitlementService.js'

let io = null
let adminNamespace = null

export function getIO() {
  return io
}

export function emitAdminCampaignEvent(event, payload = {}) {
  if (!adminNamespace || !event) return
  adminNamespace.to('notifications').emit(event, payload)
}

// ── Presence ────────────────────────────────────────────────────────────────
// In-memory online tracking: userId -> number of live socket connections.
// (Single-instance only; a multi-node deployment would need a Redis adapter.)
const onlineUsers = new Map()

export function isUserOnline(userId) {
  return (onlineUsers.get(userId) || 0) > 0
}

// Returns true when this is the user's FIRST connection (offline → online).
function addOnline(userId) {
  const n = (onlineUsers.get(userId) || 0) + 1
  onlineUsers.set(userId, n)
  return n === 1
}

// Returns true when this was the user's LAST connection (online → offline).
function removeOnline(userId) {
  const n = (onlineUsers.get(userId) || 0) - 1
  if (n <= 0) onlineUsers.delete(userId)
  else onlineUsers.set(userId, n)
  return n <= 0
}

function touchLastActive(userId) {
  db.update(users)
    .set({ lastActiveAt: new Date() })
    .where(eq(users.id, userId))
    .catch((err) => console.error('touchLastActive error:', err.message))
}

// Broadcast a presence change to both members of each of the user's matches.
// App gates display to Platin viewers; the payload itself is low-sensitivity.
function broadcastPresence(userId, matchInfos, online, lastActiveAt) {
  if (!io) return
  const payload = { userId, online, lastActiveAt: lastActiveAt ?? null }
  for (const m of matchInfos) {
    io.to(`match:${m.id}`).emit('user:presence', payload)
  }
}

// Mark every still-undelivered message addressed to `recipientId` as delivered
// (used when they come online), and tell each sender — gated by the sender's
// readReceipts entitlement — so their ticks flip to double-grey.
async function deliverPendingForRecipient(recipientId, matchInfos) {
  for (const m of matchInfos) {
    const partnerId = m.userAId === recipientId ? m.userBId : m.userAId
    try {
      const updated = await db
        .update(messages)
        .set({ deliveredAt: new Date() })
        .where(
          and(
            eq(messages.matchId, m.id),
            eq(messages.senderId, partnerId),
            isNull(messages.deliveredAt),
          ),
        )
        .returning({ id: messages.id })
      if (!updated.length) continue
      const acc = await assertFeature(partnerId, 'readReceipts')
      if (acc.ok) {
        io.to(`user:${partnerId}`).emit('message:delivered', {
          matchId: m.id,
          deliveredTo: recipientId,
        })
      }
    } catch (err) {
      console.error('deliverPending error:', err.message)
    }
  }
}

// Fire-and-forget emit to a single user's personal room (all their devices).
// Used for non-match realtime nudges like a new inbound like.
export function emitToUser(userId, event, payload) {
  if (!io || !userId || !event) return
  io.to(`user:${userId}`).emit(event, payload)
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

// True when the user currently has the given support ticket open (in its room).
export async function isUserReadingTicket(userId, ticketId) {
  if (!io || !userId || !ticketId) return false

  const sockets = await io.in(`user:${userId}`).fetchSockets()
  return sockets.some((socket) => socket.data?.activeTicketId === ticketId)
}

// Called by the admin reply controller: push the new reply to the ticket room
// (live thread) and a lightweight nudge to the user's room (badge refresh).
export function emitSupportReply({ ticketId, userId, message }) {
  if (!io || !ticketId) return
  if (message) io.to(`support:${ticketId}`).emit('support:message', message)
  if (userId) io.to(`user:${userId}`).emit('support:reply', { ticketId })
}

// Join a socket to a support ticket room — only if it owns the ticket.
async function joinSocketToTicketIfOwner(socket, ticketId) {
  if (!ticketId) return false
  const [t] = await db
    .select({ requesterUserId: supportTickets.requesterUserId })
    .from(supportTickets)
    .where(eq(supportTickets.id, ticketId))
    .limit(1)
  if (!t || t.requesterUserId !== socket.userId) return false
  socket.join(`support:${ticketId}`)
  return true
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

  adminNamespace = io.of('/admin')
  adminNamespace.use(adminSocketAuthMiddleware)
  adminNamespace.on('connection', (socket) => {
    socket.join('notifications')
    socket.on('notifications:subscribe', (_data, ack) => {
      socket.join('notifications')
      ack?.({ ok: true })
    })
  })

  io.on('connection', async (socket) => {
    const userId = socket.userId

    // Join rooms for all active matches
    try {
      const userMatches = await db
        .select({
          id: matches.id,
          userAId: matches.userAId,
          userBId: matches.userBId,
        })
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

      // Stash match membership for the disconnect handler (presence broadcast).
      socket.data.matchInfos = userMatches

      // ── Presence: mark online, stamp last-active, notify match partners ──
      const becameOnline = addOnline(userId)
      touchLastActive(userId)
      if (becameOnline) {
        broadcastPresence(userId, userMatches, true)
        // Anything sent while they were offline is now delivered.
        deliverPendingForRecipient(userId, userMatches).catch((err) =>
          console.error('deliverPending(connect) error:', err.message),
        )
      }
    } catch (err) {
      console.error('Socket room join error:', err.message)
    }

    socket.on('chat:open', async (data, ack) => {
      try {
        const { matchId } = data || {}
        const ok = await joinSocketToMatchIfMember(socket, matchId)
        if (ok) {
          socket.data.activeMatchId = matchId
          touchLastActive(userId)
        }
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

    // ── support:open / support:close — join the ticket room + presence ──
    socket.on('support:open', async (data, ack) => {
      try {
        const { ticketId } = data || {}
        const ok = await joinSocketToTicketIfOwner(socket, ticketId)
        if (ok) {
          socket.data.activeTicketId = ticketId
          touchLastActive(userId)
          // Tell the room (admins, once implemented) the user is viewing.
          io.to(`support:${ticketId}`).emit('support:presence', {
            ticketId,
            userId,
            online: true,
          })
        }
        ack?.({ ok })
      } catch (err) {
        console.error('support:open error:', err.message)
        ack?.({ ok: false })
      }
    })

    socket.on('support:close', (data, ack) => {
      const { ticketId } = data || {}
      if (!ticketId || socket.data.activeTicketId === ticketId) {
        socket.data.activeTicketId = null
      }
      if (ticketId) {
        io.to(`support:${ticketId}`).emit('support:presence', {
          ticketId,
          userId,
          online: false,
        })
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

        // Delivered immediately if the recipient currently has a live socket.
        const recipientOnline = isUserOnline(recipientId)

        const [msg] = await db
          .insert(messages)
          .values({
            matchId,
            senderId: userId,
            content: content.trim(),
            isEphemeral,
            expiresAt,
            deliveredAt: recipientOnline ? now : null,
            createdAt: now,
          })
          .returning()

        touchLastActive(userId)

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

        // If the recipient has THIS chat open, the message is read the instant it
        // arrives — mark it read now and flip the sender's tick to green instead
        // of waiting for the recipient's markRead round-trip. Otherwise it's just
        // delivered (if online) and we push a notification.
        const recipientReading = await isUserReadingMatch(recipientId, matchId)
        const senderSeesReceipts = (await assertFeature(userId, 'readReceipts')).ok

        if (recipientReading) {
          await db
            .update(messages)
            .set({ isRead: true, readAt: now })
            .where(eq(messages.id, msg.id))
          if (senderSeesReceipts) {
            io.to(`user:${userId}`).emit('message:read', { matchId, readBy: recipientId })
          }
        } else {
          if (recipientOnline && senderSeesReceipts) {
            io.to(`user:${userId}`).emit('message:delivered', {
              matchId,
              deliveredTo: recipientId,
              messageId: msg.id,
            })
          }
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

        // Atomic conditional unlock: set this side's requested flag and, in the
        // same UPDATE, flip photosUnlocked=true only when the OTHER side's flag
        // is already true in the DB. This avoids a read-then-write race where two
        // simultaneous requests both see the other as not-yet-requested.
        const otherFlag = isUserA ? matches.userBUnlockRequested : matches.userAUnlockRequested
        const updates = {
          updatedAt: new Date(),
          photosUnlocked: sql`CASE WHEN ${otherFlag} THEN true ELSE ${matches.photosUnlocked} END`,
          photosUnlockedAt: sql`CASE WHEN ${otherFlag} AND ${matches.photosUnlockedAt} IS NULL THEN NOW() ELSE ${matches.photosUnlockedAt} END`,
        }
        if (isUserA) updates.userAUnlockRequested = true
        else updates.userBUnlockRequested = true

        const [updated] = await db
          .update(matches)
          .set(updates)
          .where(eq(matches.id, matchId))
          .returning({ photosUnlocked: matches.photosUnlocked })

        const unlocked = !!updated?.photosUnlocked

        if (unlocked) {
          io.to(`match:${matchId}`).emit('unlock:complete', { matchId })
        } else {
          io.to(`match:${matchId}`).emit('unlock:requested', { matchId, requestedBy: userId })
          notifyPhotoUnlockRequest(recipientId, socket.userHandle, matchId)
        }

        ack?.({ ok: true, unlocked })
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

      // ── Presence: if this was the user's last socket, go offline ──
      const wentOffline = removeOnline(userId)
      if (wentOffline) {
        const lastActiveAt = new Date()
        db.update(users)
          .set({ lastActiveAt })
          .where(eq(users.id, userId))
          .catch((err) => console.error('disconnect lastActive error:', err.message))
        broadcastPresence(
          userId,
          socket.data.matchInfos || [],
          false,
          lastActiveAt.toISOString(),
        )
      }
    })
  })

  return io
}