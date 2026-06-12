import { Router } from 'express'
import { requireAuth } from '../../middleware/user/auth.js'
import { activateUserBoost, cancelUserBoost } from '../../controllers/User/boosts.js'

const router = Router()

router.post('/boosts/activate', requireAuth, activateUserBoost)
router.post('/boosts/cancel', requireAuth, cancelUserBoost)

export default router
