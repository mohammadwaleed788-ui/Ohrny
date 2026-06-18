import { Router } from 'express'
import { requireAuth, requireRole } from '../../middleware/admin/auth.js'
import {
  decideAppeal,
  enforceReport,
  getAppealDetail,
  getReportDetail,
  getTrustSummary,
  listAppeals,
  listBans,
  listReports,
  unbanUser,
  updateReport,
} from '../../controllers/Admin/trust.js'

const router = Router()

router.get('/trust/reports', requireAuth, listReports)
router.get('/trust/reports/:reportId', requireAuth, getReportDetail)
router.patch('/trust/reports/:reportId', requireAuth, requireRole('moderator', 'super_admin'), updateReport)
router.post('/trust/reports/:reportId/enforce', requireAuth, requireRole('moderator', 'super_admin'), enforceReport)

router.get('/trust/summary', requireAuth, getTrustSummary)
router.get('/trust/bans', requireAuth, requireRole('support', 'moderator', 'super_admin'), listBans)
router.post('/trust/users/:userId/unban', requireAuth, requireRole('super_admin'), unbanUser)

router.get('/trust/appeals', requireAuth, requireRole('support', 'moderator', 'super_admin'), listAppeals)
router.get('/trust/appeals/:appealId', requireAuth, requireRole('support', 'moderator', 'super_admin'), getAppealDetail)
router.post('/trust/appeals/:appealId/decide', requireAuth, requireRole('moderator', 'super_admin'), decideAppeal)

export default router
