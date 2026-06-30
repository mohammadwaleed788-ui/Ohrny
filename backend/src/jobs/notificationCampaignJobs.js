import cron from 'node-cron'
import { runDueScheduledCampaigns, runReengagementRules } from '../services/notifications/campaignNotification.js'

export function startNotificationCampaignJobs() {
  cron.schedule('* * * * *', async () => {
    try {
      const count = await runDueScheduledCampaigns()
      if (count > 0) {
        console.log(`[notification-campaign-jobs] Queued ${count} due scheduled campaign(s)`)
      }
      const reengagementSent = await runReengagementRules()
      if (reengagementSent > 0) {
        console.log(`[notification-campaign-jobs] Sent ${reengagementSent} re-engagement notification(s)`)
      }
    } catch (err) {
      console.error('[notification-campaign-jobs] Scheduler error:', err.message)
    }
  }, { timezone: 'UTC' })

  console.log('[notification-campaign-jobs] Scheduled every minute (UTC)')
}
