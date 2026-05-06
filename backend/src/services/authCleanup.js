import { lt } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { userSessions } from '../../db/schema/users.js'
import { adminSessions } from '../../db/schema/admin.js'
import { phoneVerifications } from '../../db/schema/safety.js'

async function cleanupOnce() {
  const now = new Date()
  await Promise.all([
    db.delete(phoneVerifications).where(lt(phoneVerifications.expiresAt, now)),
    db.delete(userSessions).where(lt(userSessions.expiresAt, now)),
    db.delete(adminSessions).where(lt(adminSessions.expiresAt, now)),
  ])
}

export function startAuthDataCleanup() {
  cleanupOnce().catch((err) => {
    console.error('Auth cleanup startup run failed', err)
  })

  const everyHourMs = 60 * 60 * 1000
  setInterval(() => {
    cleanupOnce().catch((err) => {
      console.error('Auth cleanup scheduled run failed', err)
    })
  }, everyHourMs)
}
