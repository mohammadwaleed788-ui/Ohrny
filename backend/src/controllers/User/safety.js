import { and, eq, isNull, or } from 'drizzle-orm'
import { db } from '../../../db/index.js'
import { likes, matches } from '../../../db/schema/matching.js'
import { messages } from '../../../db/schema/messaging.js'
import { appeals, blocks, reports, userEnforcements } from '../../../db/schema/safety.js'
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
      return res.status(400).json({ error: 'reported_id_required', message: 'reportedId required' })
    }
    if (!VALID_REASONS.includes(reason)) {
      return res.status(400).json({ error: 'invalid_reason', message: 'Invalid reason' })
    }
    if (reporterId === reportedId) {
      return res.status(400).json({ error: 'cannot_report_self', message: 'Cannot report yourself' })
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
    return res.status(500).json({ error: 'report_submit_failed', message: 'Failed to submit report' })
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
      return res.status(400).json({ error: 'user_id_required', message: 'userId required' })
    }
    if (blockerId === blockedId) {
      return res.status(400).json({ error: 'cannot_block_self', message: 'Cannot block yourself' })
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
    return res.status(500).json({ error: 'block_user_failed', message: 'Failed to block user' })
  }
}

// ── POST /user/appeals ─────────────────────────────────────────
// User submits an appeal for a currently active enforcement.
export async function createAppeal(req, res) {
  try {
    const userId = req.user.id
    const enforcementId = String(req.body?.enforcementId || '').trim()
    const statement = String(req.body?.statement || '').trim()

    if (!enforcementId) return res.status(400).json({ error: 'enforcement_id_required', message: 'enforcementId required' })
    if (!statement) return res.status(400).json({ error: 'statement_required', message: 'statement required' })
    if (statement.length > 2000) return res.status(400).json({ error: 'statement_too_long', message: 'statement too long' })

    const [enforcement] = await db
      .select({ id: userEnforcements.id, active: userEnforcements.active })
      .from(userEnforcements)
      .where(and(eq(userEnforcements.id, enforcementId), eq(userEnforcements.userId, userId)))
      .limit(1)

    if (!enforcement) return res.status(404).json({ error: 'enforcement_not_found', message: 'Enforcement not found' })
    if (!enforcement.active) return res.status(400).json({ error: 'enforcement_not_active', message: 'Enforcement is no longer active' })

    const existing = await db
      .select({ id: appeals.id })
      .from(appeals)
      .where(and(eq(appeals.enforcementId, enforcementId), eq(appeals.status, 'open')))
      .limit(1)

    if (existing[0]) return res.status(409).json({ error: 'appeal_already_open', message: 'An open appeal already exists' })

    const [created] = await db
      .insert(appeals)
      .values({
        enforcementId,
        userId,
        statement,
      })
      .returning({ id: appeals.id, status: appeals.status, createdAt: appeals.createdAt })

    return res.json({ ok: true, appeal: created })
  } catch (err) {
    console.error('createAppeal error:', err.message)
    return res.status(500).json({ error: 'appeal_submit_failed', message: 'Failed to submit appeal' })
  }
}
