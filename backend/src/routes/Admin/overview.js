import { Router } from 'express'
import { requireAuth } from '../../middleware/admin/auth.js'
import { getOverview } from '../../controllers/Admin/overview.js'

const router = Router()

router.get('/overview', requireAuth, getOverview)

export default router
