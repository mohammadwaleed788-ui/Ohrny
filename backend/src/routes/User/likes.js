import { Router } from 'express'
import { requireAuth } from '../../middleware/user/auth.js'
import { getReceivedLikes, likeBack, passLiker } from '../../controllers/User/likes.js'

const router = Router()

router.get('/likes/received', requireAuth, getReceivedLikes)
router.post('/likes/:fromUserId/pass', requireAuth, passLiker)
router.post('/likes/:fromUserId/like-back', requireAuth, likeBack)

export default router
