import { Router } from 'express'
import { requireAuth, requireTab } from '../../middleware/admin/auth.js'
import { getOverview } from '../../controllers/Admin/overview.js'

const router = Router()

router.get('/overview', requireAuth, requireTab('overview'), getOverview)

export default router
