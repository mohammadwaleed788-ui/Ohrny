import { Router } from 'express'
import { requireAuth } from '../../middleware/admin/auth.js'
import { getMatches } from '../../controllers/Admin/matches.js'

const router = Router()

router.get('/matches', requireAuth, getMatches)

export default router
