import { Router } from 'express'
import { requireAuth } from '../../middleware/user/auth.js'
import { activateUserBoost } from '../../controllers/User/boosts.js'

const router = Router()

router.post('/boosts/activate', requireAuth, activateUserBoost)

export default router
