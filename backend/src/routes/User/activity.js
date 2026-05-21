import { Router } from 'express'
import { requireAuth } from '../../middleware/user/auth.js'
import { logActivity } from '../../controllers/User/activity.js'

const router = Router()

router.post('/activity', requireAuth, logActivity)

export default router
