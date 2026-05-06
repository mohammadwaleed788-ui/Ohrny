import { Router } from 'express'
import * as auth from '../../controllers/Admin/auth.js'
import { requireAuth } from '../../middleware/admin/auth.js'
import { authLoginLimiter, otpLimiter, refreshLimiter } from '../../middleware/security/rateLimit.js'

const router = Router()

router.post('/auth/login', authLoginLimiter, auth.login)
router.post('/auth/verify-totp', otpLimiter, auth.verifyTotp)
router.post('/auth/refresh', refreshLimiter, auth.refresh)
router.get('/auth/me', requireAuth, auth.me)

export default router
