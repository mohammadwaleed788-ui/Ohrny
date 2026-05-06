import { Router } from 'express'
import * as auth from '../../controllers/User/auth.js'
import { requireAuth } from '../../middleware/user/auth.js'
import { otpLimiter, refreshLimiter } from '../../middleware/security/rateLimit.js'

const router = Router()

router.post('/auth/send-otp', otpLimiter, auth.sendOtp)
router.post('/auth/verify-otp', otpLimiter, auth.verifyOtp)
router.post('/auth/onboarding/complete', auth.completeOnboarding)
router.post('/auth/refresh', refreshLimiter, auth.refresh)
router.get('/auth/me', requireAuth, auth.me)

export default router
