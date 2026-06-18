import { Router } from 'express'
import { requireAuth } from '../../middleware/user/auth.js'
import {
  createSupportTicket,
  getUserSupportTicketDetail,
  listUserSupportTickets,
  rateUserSupportTicket,
  replyUserSupportTicket,
} from '../../controllers/User/support.js'

const router = Router()

router.post('/support/tickets', requireAuth, createSupportTicket)
router.get('/support/tickets', requireAuth, listUserSupportTickets)
router.get('/support/tickets/:ticketId', requireAuth, getUserSupportTicketDetail)
router.post('/support/tickets/:ticketId/replies', requireAuth, replyUserSupportTicket)
router.post('/support/tickets/:ticketId/csat', requireAuth, rateUserSupportTicket)

export default router
