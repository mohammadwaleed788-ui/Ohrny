import { Router } from 'express'
import { requireAuth, requireRole, requireTab } from '../../middleware/admin/auth.js'
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
const supportTab = requireTab('support')
const supportRole = requireRole('support', 'moderator', 'super_admin')

router.get('/support/summary', requireAuth, supportTab, supportRole, getSupportSummary)
router.get('/support/macros', requireAuth, supportTab, supportRole, listSupportMacros)
router.get('/support/weekly-report.csv', requireAuth, supportTab, supportRole, exportWeeklySupportReport)
router.get('/support/tickets', requireAuth, supportTab, supportRole, listSupportTickets)
router.get('/support/tickets/:ticketId', requireAuth, supportTab, supportRole, getSupportTicketDetail)
router.post('/support/tickets', requireAuth, supportTab, supportRole, createSupportTicket)
router.patch('/support/tickets/:ticketId', requireAuth, supportTab, supportRole, updateSupportTicket)
router.post('/support/tickets/:ticketId/assign-self', requireAuth, supportTab, supportRole, assignSupportTicketToMe)
router.post('/support/tickets/:ticketId/replies', requireAuth, supportTab, supportRole, replySupportTicket)

export default router
