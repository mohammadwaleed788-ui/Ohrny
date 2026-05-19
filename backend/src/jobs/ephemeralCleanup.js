import cron from 'node-cron'
import { and, lt, eq, isNotNull, sql } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { messages } from '../../db/schema/messaging.js'

export function startEphemeralCleanup() {
  // Run nightly at midnight UTC
  cron.schedule('0 0 * * *', async () => {
    try {
      const now = new Date()

      // Hard-delete expired ephemeral messages
      const ephemeralResult = await db
        .delete(messages)
        .where(
          and(
            eq(messages.isEphemeral, true),
            isNotNull(messages.expiresAt),
            lt(messages.expiresAt, now),
          ),
        )

      // Hard-delete soft-deleted messages older than 30 days
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      const softDeleteResult = await db
        .delete(messages)
        .where(
          and(
            isNotNull(messages.deletedAt),
            lt(messages.deletedAt, thirtyDaysAgo),
          ),
        )

      console.log(`[ephemeral-cleanup] Ran at ${now.toISOString()}`)
    } catch (err) {
      console.error('[ephemeral-cleanup] Error:', err.message)
    }
  }, { timezone: 'UTC' })

  console.log('[ephemeral-cleanup] Scheduled nightly at 00:00 UTC')
}
