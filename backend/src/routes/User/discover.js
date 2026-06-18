import { Router } from 'express'
import { requireAuth } from '../../middleware/user/auth.js'
import { getDiscoverCards, swipeDiscoverCard, getUserProfile, rewindLastSwipe, recordView } from '../../controllers/User/discover.js'

const router = Router()

router.get('/discover/cards', requireAuth, getDiscoverCards)
router.post('/discover/swipe', requireAuth, swipeDiscoverCard)
router.post('/discover/rewind', requireAuth, rewindLastSwipe)
router.get('/discover/profile/:userId', requireAuth, getUserProfile)
router.post('/discover/view/:userId', requireAuth, recordView)

export default router
