import { Router } from 'express'
import { requireAuth, requireTab } from '../../middleware/admin/auth.js'
import { getRevenue } from '../../controllers/Admin/revenue.js'

const router = Router()

router.get('/revenue', requireAuth, requireTab('revenue'), getRevenue)

export default router
