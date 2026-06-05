import { Router } from 'express'
import { handleRevenueCatWebhook } from '../../controllers/Shared/revenuecat.js'

const router = Router()

router.post('/webhooks/revenuecat', handleRevenueCatWebhook)

export default router
