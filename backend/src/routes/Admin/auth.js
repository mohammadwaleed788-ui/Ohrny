import { Router } from 'express'
import * as auth from '../../controllers/admin/auth.js'
import { requireAuth } from '../../middleware/admin/auth.js'

const router = Router()

router.post('/auth/login', auth.login)
router.post('/auth/verify-totp', auth.verifyTotp)
router.post('/auth/refresh', auth.refresh)
router.post('/auth/logout', requireAuth, auth.logout)
router.get('/auth/me', requireAuth, auth.me)

export default router
