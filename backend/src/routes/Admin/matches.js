import { Router } from 'express'
import { requireAuth, requireTab } from '../../middleware/admin/auth.js'
import { getMatches } from '../../controllers/Admin/matches.js'

const router = Router()

router.get('/matches', requireAuth, requireTab('matches'), getMatches)

export default router
