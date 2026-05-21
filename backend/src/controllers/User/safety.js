import { and, eq, isNull, or } from 'drizzle-orm'
import { db } from '../../../db/index.js'
import { likes, matches } from '../../../db/schema/matching.js'
import { messages } from '../../../db/schema/messaging.js'
import { blocks, reports } from '../../../db/schema/safety.js'
import { getIO } from '../../socket/index.js'

const VALID_REASONS = ['fake', 'inappropriate', 'harassment', 'minor', 'spam', 'safety', 'other']

// ── POST /user/reports ────────────────────────────────────────
// Creates a report and silently blocks the reported user.
// Flutter separately calls DELETE /user/matches/:matchId to unmatch.
export async function createReport(req, res) {
  try {
    const reporterId = req.user.id
    const { reportedId, reason, details } = req.body || {}

    if (!reportedId || typeof reportedId !== 'string') {
      return res.status(400).json({ error: 'reportedId required' })
    }
    if (!VALID_REASONS.includes(reason)) {
      return res.status(400).json({ error: 'Invalid reason' })
    }
    if (reporterId === reportedId) {
      return res.status(400).json({ error: 'Cannot report yourself' })
    }

    // Insert report
    await db.insert(reports).values({
      reporterId,
      reportedId,
      reason,
      details: details ?? null,
    })

    // Block so they never appear in discovery or likes for each other
    await db
      .insert(blocks)
      .values({ blockerId: reporterId, blockedId: reportedId })
      .onConflictDoNothing()

    return res.json({ ok: true })
  } catch (err) {
    console.error('createReport error:', err.message)
    return res.status(500).json({ error: 'Failed to submit report' })
  }
}

// ── POST /user/blocks/:userId ─────────────────────────────────
// Blocks a user. Deactivates any active match, deletes like rows,
// soft-deletes messages, notifies partner via socket.
export async function blockUser(req, res) {
  try {
    const blockerId = req.user.id
    const blockedId = req.params.userId

    if (!blockedId || typeof blockedId !== 'string') {
      return res.status(400).json({ error: 'userId required' })
    }
    if (blockerId === blockedId) {
      return res.status(400).json({ error: 'Cannot block yourself' })
    }

    // Insert block (idempotent)
    await db
      .insert(blocks)
      .values({ blockerId, blockedId })
      .onConflictDoNothing()

    // Find any active match between the two users
    const [match] = await db
      .select({ id: matches.id, userAId: matches.userAId, userBId: matches.userBId })
      .from(matches)
      .where(
        and(
          eq(matches.isActive, true),
          or(
            and(eq(matches.userAId, blockerId), eq(matches.userBId, blockedId)),
            and(eq(matches.userAId, blockedId), eq(matches.userBId, blockerId)),
          ),
        ),
      )
      .limit(1)

    if (match) {
      // Deactivate the match
      await db
        .update(matches)
        .set({ isActive: false, unmatchedAt: new Date(), unmatchedByUserId: blockerId, updatedAt: new Date() })
        .where(eq(matches.id, match.id))

      // Soft-delete all messages
      await db
        .update(messages)
        .set({ deletedAt: new Date() })
        .where(and(eq(messages.matchId, match.id), isNull(messages.deletedAt)))

      // Notify partner's connected clients
      const io = getIO()
      if (io) {
        io.to(`user:${blockedId}`).emit('match:removed', { matchId: match.id })
      }
    }

    // Delete like rows so if block is ever lifted, both users start fresh
    await db
      .delete(likes)
      .where(
        or(
          and(eq(likes.fromUserId, blockerId), eq(likes.toUserId, blockedId)),
          and(eq(likes.fromUserId, blockedId), eq(likes.toUserId, blockerId)),
        ),
      )

    return res.json({ ok: true })
  } catch (err) {
    console.error('blockUser error:', err.message)
    return res.status(500).json({ error: 'Failed to block user' })
  }
}
