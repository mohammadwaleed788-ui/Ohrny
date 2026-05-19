import { Router } from 'express'
import { requireAuth } from '../../middleware/user/auth.js'
import { getMatches, getMessages, sendMessage, markRead, requestUnlock, unmatch } from '../../controllers/User/chat.js'
import { initiateCall, updateCallStatus, getCallHistory } from '../../controllers/User/call.js'

const router = Router()

// Match endpoints
router.get('/matches', requireAuth, getMatches)
router.delete('/matches/:matchId', requireAuth, unmatch)

// Message endpoints
router.get('/matches/:matchId/messages', requireAuth, getMessages)
router.post('/matches/:matchId/messages', requireAuth, sendMessage)
router.patch('/matches/:matchId/read', requireAuth, markRead)

// Photo unlock
router.post('/matches/:matchId/unlock', requireAuth, requestUnlock)

// Call endpoints
router.post('/matches/:matchId/calls', requireAuth, initiateCall)
router.get('/matches/:matchId/calls', requireAuth, getCallHistory)
router.patch('/calls/:callId', requireAuth, updateCallStatus)

export default router
