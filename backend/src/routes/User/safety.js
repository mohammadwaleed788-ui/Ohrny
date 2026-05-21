import { Router } from 'express'
import { requireAuth } from '../../middleware/user/auth.js'
import { createReport, blockUser } from '../../controllers/User/safety.js'

const router = Router()

router.post('/reports', requireAuth, createReport)
router.post('/blocks/:userId', requireAuth, blockUser)

export default router
