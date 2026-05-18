import { Router } from 'express'
import { requireAuth } from '../../middleware/user/auth.js'
import { getDiscoverCards, swipeDiscoverCard } from '../../controllers/User/discover.js'

const router = Router()

router.get('/discover/cards', requireAuth, getDiscoverCards)
router.post('/discover/swipe', requireAuth, swipeDiscoverCard)

export default router
