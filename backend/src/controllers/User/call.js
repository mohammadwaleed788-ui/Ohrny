import { and, desc, eq, or } from 'drizzle-orm'
import { db } from '../../../db/index.js'
import { matches } from '../../../db/schema/matching.js'
import { calls } from '../../../db/schema/messaging.js'
import { users } from '../../../db/schema/users.js'
import { getIO } from '../../socket/index.js'
import { notifyIncomingCall } from '../../services/notifications/chatNotification.js'
import { generateZegoToken, ZEGO_APP_ID } from '../../services/zegoService.js'

const VALID_CALL_TYPES = ['voice', 'video']
const VALID_STATUS_UPDATES = ['answered', 'declined', 'ended', 'missed']

// ── POST /user/matches/:matchId/calls ─────────────────────────
export async function initiateCall(req, res) {
  try {
    const userId = req.user.id
    const { matchId } = req.params
    const { type } = req.body || {}

    if (!VALID_CALL_TYPES.includes(type)) {
      return res.status(400).json({ error: 'type must be "voice" or "video"' })
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

    const calleeId = isUserA ? match.userBId : match.userAId

    const [call] = await db
      .insert(calls)
      .values({
        matchId,
        callerId: userId,
        calleeId,
        type,
        status: 'initiated',
        voiceMasked: true,
        callerSelfieBlurred: true,
        createdAt: new Date(),
      })
      .returning()

    // Emit only to the callee — never broadcast to the full match room
    // (that would send the event to the caller too)
    const io = getIO()
    if (io) {
      const calleeSockets = await io.in(`user:${calleeId}`).fetchSockets()
      if (calleeSockets.length > 0) {
        // Callee is online — deliver via socket
        io.to(`user:${calleeId}`).emit('call:incoming', {
          callId: call.id,
          matchId,
          callerId: userId,
          callerHandle: req.user.handle,
          type,
        })
      } else {
        // Callee is offline — deliver via push notification
        notifyIncomingCall(calleeId, req.user.handle, type, { callId: call.id, matchId })
      }
    } else {
      notifyIncomingCall(calleeId, req.user.handle, type, { callId: call.id, matchId })
    }

    return res.json({ ok: true, call })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Failed to initiate call' })
  }
}

// ── PATCH /user/calls/:callId ─────────────────────────────────
export async function updateCallStatus(req, res) {
  try {
    const userId = req.user.id
    const { callId } = req.params
    const { status, voiceMasked, callerSelfieBlurred } = req.body || {}

    if (!VALID_STATUS_UPDATES.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${VALID_STATUS_UPDATES.join(', ')}` })
    }

    const [call] = await db
      .select()
      .from(calls)
      .where(eq(calls.id, callId))
      .limit(1)

    if (!call) return res.status(404).json({ error: 'Call not found' })
    if (call.callerId !== userId && call.calleeId !== userId) {
      return res.status(403).json({ error: 'Not a participant in this call' })
    }

    const updates = { status }
    const now = new Date()

    if (status === 'answered') {
      updates.startedAt = now
    }

    if (status === 'ended' || status === 'declined' || status === 'missed') {
      updates.endedAt = now
      if (call.startedAt) {
        updates.durationSeconds = Math.round((now.getTime() - new Date(call.startedAt).getTime()) / 1000)
      }
    }

    if (typeof voiceMasked === 'boolean') updates.voiceMasked = voiceMasked
    if (typeof callerSelfieBlurred === 'boolean') updates.callerSelfieBlurred = callerSelfieBlurred

    const [updated] = await db
      .update(calls)
      .set(updates)
      .where(eq(calls.id, callId))
      .returning()

    // Notify only the OTHER participant — never echo back to sender
    const io = getIO()
    if (io) {
      const otherId = call.callerId === userId ? call.calleeId : call.callerId
      io.to(`user:${otherId}`).emit('call:status', {
        callId,
        matchId: call.matchId,
        status: updated.status,
        updatedBy: userId,
      })
    }

    return res.json({ ok: true, call: updated })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Failed to update call' })
  }
}

// ── GET /user/matches/:matchId/calls ──────────────────────────
export async function getCallHistory(req, res) {
  try {
    const userId = req.user.id
    const { matchId } = req.params

    const [match] = await db
      .select({ userAId: matches.userAId, userBId: matches.userBId })
      .from(matches)
      .where(eq(matches.id, matchId))
      .limit(1)

    if (!match) return res.status(404).json({ error: 'Match not found' })
    if (match.userAId !== userId && match.userBId !== userId) {
      return res.status(403).json({ error: 'Not in this match' })
    }

    const rows = await db
      .select({
        id: calls.id,
        callerId: calls.callerId,
        calleeId: calls.calleeId,
        type: calls.type,
        status: calls.status,
        voiceMasked: calls.voiceMasked,
        startedAt: calls.startedAt,
        endedAt: calls.endedAt,
        durationSeconds: calls.durationSeconds,
        createdAt: calls.createdAt,
      })
      .from(calls)
      .where(eq(calls.matchId, matchId))
      .orderBy(desc(calls.createdAt))
      .limit(50)

    return res.json({
      calls: rows.map((c) => ({
        ...c,
        initiatedByMe: c.callerId === userId,
      })),
    })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Failed to load call history' })
  }
}

// ── POST /user/calls/zego-token ───────────────────────────────
// Returns a short-lived ZegoCloud token for the calling user.
// roomId = matchId so both participants join the same room.
export async function getZegoToken(req, res) {
  try {
    const userId = req.user.id
    const { matchId } = req.body || {}

    if (!matchId) {
      return res.status(400).json({ error: 'matchId is required' })
    }

    // Verify caller is in this match
    const [match] = await db
      .select({ userAId: matches.userAId, userBId: matches.userBId })
      .from(matches)
      .where(and(eq(matches.id, matchId), eq(matches.isActive, true)))
      .limit(1)

    if (!match) return res.status(404).json({ error: 'Match not found' })
    if (match.userAId !== userId && match.userBId !== userId) {
      return res.status(403).json({ error: 'Not in this match' })
    }

    const token = generateZegoToken(userId, 3600)

    return res.json({
      token,
      appId: ZEGO_APP_ID,
      roomId: matchId,
      userId,
    })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Failed to generate call token' })
  }
}
