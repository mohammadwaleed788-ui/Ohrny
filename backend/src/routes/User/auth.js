import { Router } from 'express'
import * as auth from '../../controllers/user/auth.js'
import { requireAuth } from '../../middleware/user/auth.js'

const router = Router()

router.post('/auth/send-otp', auth.sendOtp)
router.post('/auth/verify-otp', auth.verifyOtp)
router.post('/auth/refresh', auth.refresh)
router.post('/auth/logout', requireAuth, auth.logout)
router.get('/auth/me', requireAuth, auth.me)

export default router
