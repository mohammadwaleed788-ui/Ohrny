import { Router } from 'express'
import { requireAuth, requireRole, requireTab } from '../../middleware/admin/auth.js'
import {
  cancelScheduledCampaign,
  createNotificationCampaign,
  getCampaignDeliveries,
  getNotificationsSummary,
  listReengagementRules,
  listNotificationCampaigns,
  retryCampaignSend,
  testSendReengagementRule,
  sendCampaignImmediately,
  updateReengagementRule,
} from '../../controllers/Admin/notifications.js'

const router = Router()
const notificationsTab = requireTab('notifications')
const notificationsRole = requireRole('support', 'moderator', 'super_admin')

router.get('/notifications/summary', requireAuth, notificationsTab, notificationsRole, getNotificationsSummary)
router.get('/notifications/campaigns', requireAuth, notificationsTab, notificationsRole, listNotificationCampaigns)
router.post('/notifications/campaigns', requireAuth, notificationsTab, notificationsRole, createNotificationCampaign)
router.post('/notifications/campaigns/:campaignId/send-now', requireAuth, notificationsTab, notificationsRole, sendCampaignImmediately)
router.post('/notifications/campaigns/:campaignId/retry', requireAuth, notificationsTab, notificationsRole, retryCampaignSend)
router.post('/notifications/campaigns/:campaignId/cancel', requireAuth, notificationsTab, notificationsRole, cancelScheduledCampaign)
router.get('/notifications/campaigns/:campaignId/deliveries', requireAuth, notificationsTab, notificationsRole, getCampaignDeliveries)
router.get('/notifications/reengagement/rules', requireAuth, notificationsTab, notificationsRole, listReengagementRules)
router.patch('/notifications/reengagement/rules/:ruleId', requireAuth, notificationsTab, notificationsRole, updateReengagementRule)
router.post('/notifications/reengagement/rules/:ruleId/test-send', requireAuth, notificationsTab, notificationsRole, testSendReengagementRule)

export default router
