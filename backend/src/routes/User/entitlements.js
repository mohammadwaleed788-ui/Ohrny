import { Router } from 'express'
import { requireAuth } from '../../middleware/user/auth.js'
import { getEntitlements, getSubscriptionProducts, syncConsumablePurchase, syncSubscriptionPurchase } from '../../controllers/User/entitlements.js'

const router = Router()

router.get('/entitlements', requireAuth, getEntitlements)
router.get('/subscription-products', requireAuth, getSubscriptionProducts)
router.post('/purchases/sync', requireAuth, syncConsumablePurchase)
router.post('/purchases/sync-subscription', requireAuth, syncSubscriptionPurchase)

export default router
