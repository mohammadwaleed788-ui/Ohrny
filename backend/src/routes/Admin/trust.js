import { Router } from 'express'
import { requireAuth, requireRole, requireTab } from '../../middleware/admin/auth.js'
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
const trustTab = requireTab('trust')

router.get('/trust/reports', requireAuth, trustTab, listReports)
router.get('/trust/reports/:reportId', requireAuth, trustTab, getReportDetail)
router.patch('/trust/reports/:reportId', requireAuth, trustTab, requireRole('moderator', 'super_admin'), updateReport)
router.post('/trust/reports/:reportId/enforce', requireAuth, trustTab, requireRole('moderator', 'super_admin'), enforceReport)

router.get('/trust/summary', requireAuth, trustTab, getTrustSummary)
router.get('/trust/bans', requireAuth, trustTab, requireRole('support', 'moderator', 'super_admin'), listBans)
router.post('/trust/users/:userId/unban', requireAuth, trustTab, requireRole('super_admin'), unbanUser)

router.get('/trust/appeals', requireAuth, trustTab, requireRole('support', 'moderator', 'super_admin'), listAppeals)
router.get('/trust/appeals/:appealId', requireAuth, trustTab, requireRole('support', 'moderator', 'super_admin'), getAppealDetail)
router.post('/trust/appeals/:appealId/decide', requireAuth, trustTab, requireRole('moderator', 'super_admin'), decideAppeal)

export default router
