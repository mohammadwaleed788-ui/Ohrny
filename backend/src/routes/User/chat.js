import { Router } from 'express'
import { requireAuth } from '../../middleware/user/auth.js'
import {
  getMatches,
  getMessages,
  sendMessage,
  markRead,
  requestUnlock,
  unmatch,
  deleteMessage,
  deleteAllMessages,
  getPartnerProfile,
} from '../../controllers/User/chat.js'
import { initiateCall, updateCallStatus, getCallHistory, getZegoToken } from '../../controllers/User/call.js'

const router = Router()

// Match endpoints
router.get('/matches', requireAuth, getMatches)
router.delete('/matches/:matchId', requireAuth, unmatch)
router.get('/matches/:matchId/partner-profile', requireAuth, getPartnerProfile)

// Message endpoints
router.get('/matches/:matchId/messages', requireAuth, getMessages)
router.post('/matches/:matchId/messages', requireAuth, sendMessage)
router.patch('/matches/:matchId/read', requireAuth, markRead)
router.delete('/matches/:matchId/messages/:messageId', requireAuth, deleteMessage)
router.delete('/matches/:matchId/messages', requireAuth, deleteAllMessages)

// Photo unlock
router.post('/matches/:matchId/unlock', requireAuth, requestUnlock)

// Call endpoints
router.post('/matches/:matchId/calls', requireAuth, initiateCall)
router.get('/matches/:matchId/calls', requireAuth, getCallHistory)
router.patch('/calls/:callId', requireAuth, updateCallStatus)
router.post('/calls/zego-token', requireAuth, getZegoToken)

export default router
