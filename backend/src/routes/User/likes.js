import { Router } from 'express'
import { requireAuth } from '../../middleware/user/auth.js'
import { getReceivedLikes, getSentLikes, unlikeUser, likeBack, passLiker, markLikerSeen, markMatchSeen, getLikesActivity } from '../../controllers/User/likes.js'

const router = Router()

router.get('/likes/received', requireAuth, getReceivedLikes)
router.get('/likes/sent', requireAuth, getSentLikes)
router.get('/likes/activity', requireAuth, getLikesActivity)
router.delete('/likes/:toUserId', requireAuth, unlikeUser)
router.post('/likes/:fromUserId/pass', requireAuth, passLiker)
router.post('/likes/:fromUserId/seen', requireAuth, markLikerSeen)
router.post('/likes/:otherUserId/match-seen', requireAuth, markMatchSeen)
router.post('/likes/:fromUserId/like-back', requireAuth, likeBack)

export default router
