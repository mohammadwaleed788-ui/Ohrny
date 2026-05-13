import { Router } from 'express'
import { requireAuth } from '../../middleware/user/auth.js'
import { getDiscoverCards } from '../../controllers/User/discover.js'

const router = Router()

router.get('/discover/cards', requireAuth, getDiscoverCards)

export default router
