import { Router } from 'express'
import { requireAuth } from '../../middleware/user/auth.js'
import { getEntitlements, getSubscriptionProducts } from '../../controllers/User/entitlements.js'

const router = Router()

router.get('/entitlements', requireAuth, getEntitlements)
router.get('/subscription-products', requireAuth, getSubscriptionProducts)

export default router
