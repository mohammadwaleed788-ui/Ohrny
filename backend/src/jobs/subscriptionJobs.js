import cron from 'node-cron'
import { deactivateExpiredBoosts, grantWeeklyPlatinBoosts, seedSubscriptionCatalog } from '../services/entitlementService.js'

export function startSubscriptionJobs() {
  seedSubscriptionCatalog()
    .then(() => {
      console.log('[subscription-jobs] Subscription catalog seed verified')
    })
    .catch((err) => {
      console.error('[subscription-jobs] Catalog seed error:', err.message)
    })

  cron.schedule('0 0 * * 1', async () => {
    try {
      await grantWeeklyPlatinBoosts()
      console.log(`[subscription-jobs] Weekly boosts granted at ${new Date().toISOString()}`)
    } catch (err) {
      console.error('[subscription-jobs] Weekly boost grant error:', err.message)
    }
  }, { timezone: 'UTC' })

  cron.schedule('*/5 * * * *', async () => {
    try {
      const deactivated = await deactivateExpiredBoosts()
      if (deactivated > 0) {
        console.log(`[subscription-jobs] Deactivated ${deactivated} expired boosts`)
      }
    } catch (err) {
      console.error('[subscription-jobs] Boost expiration error:', err.message)
    }
  }, { timezone: 'UTC' })

  console.log('[subscription-jobs] Scheduled weekly boost grant Monday 00:00 UTC')
  console.log('[subscription-jobs] Scheduled expired boost cleanup every 5 minutes')
}
