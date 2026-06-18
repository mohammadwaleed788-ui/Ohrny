import { Router } from 'express'
import { requireAuth, requireRole } from '../../middleware/admin/auth.js'
import {
  assignSupportTicketToMe,
  createSupportTicket,
  exportWeeklySupportReport,
  getSupportSummary,
  getSupportTicketDetail,
  listSupportMacros,
  listSupportTickets,
  replySupportTicket,
  updateSupportTicket,
} from '../../controllers/Admin/support.js'

const router = Router()

router.get('/support/summary', requireAuth, requireRole('support', 'moderator', 'super_admin'), getSupportSummary)
router.get('/support/macros', requireAuth, requireRole('support', 'moderator', 'super_admin'), listSupportMacros)
router.get('/support/weekly-report.csv', requireAuth, requireRole('support', 'moderator', 'super_admin'), exportWeeklySupportReport)
router.get('/support/tickets', requireAuth, requireRole('support', 'moderator', 'super_admin'), listSupportTickets)
router.get('/support/tickets/:ticketId', requireAuth, requireRole('support', 'moderator', 'super_admin'), getSupportTicketDetail)
router.post('/support/tickets', requireAuth, requireRole('support', 'moderator', 'super_admin'), createSupportTicket)
router.patch('/support/tickets/:ticketId', requireAuth, requireRole('support', 'moderator', 'super_admin'), updateSupportTicket)
router.post('/support/tickets/:ticketId/assign-self', requireAuth, requireRole('support', 'moderator', 'super_admin'), assignSupportTicketToMe)
router.post('/support/tickets/:ticketId/replies', requireAuth, requireRole('support', 'moderator', 'super_admin'), replySupportTicket)

export default router
