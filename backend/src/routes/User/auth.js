import { Router } from 'express'
import * as auth from '../../controllers/User/auth.js'
import { requireAuth } from '../../middleware/user/auth.js'
import { otpLimiter, refreshLimiter, checkHandleLimiter } from '../../middleware/security/rateLimit.js'

const router = Router()

router.get('/auth/check-handle', checkHandleLimiter, auth.checkHandle)
router.post('/auth/send-otp', otpLimiter, auth.sendOtp)
router.post('/auth/verify-otp', otpLimiter, auth.verifyOtp)
router.post('/auth/onboarding/complete', auth.completeOnboarding)
router.post('/auth/refresh', refreshLimiter, auth.refresh)
router.get('/auth/me', requireAuth, auth.me)
router.post('/auth/logout', requireAuth, auth.logout)
router.patch('/profile', requireAuth, auth.updateProfile)
router.patch('/privacy', requireAuth, auth.updatePrivacy)
router.patch('/preferences', requireAuth, auth.updatePreferences)
router.delete('/account', requireAuth, auth.deleteAccount)
router.post('/account/wipe', requireAuth, auth.wipeAccount)
router.patch('/account/pause', requireAuth, auth.pauseAccount)

export default router
