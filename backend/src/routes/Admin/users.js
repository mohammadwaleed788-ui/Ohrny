import { Router } from 'express'
import { requireAuth } from '../../middleware/admin/auth.js'
import { getUsers, getUserDetail } from '../../controllers/Admin/users.js'

const router = Router()

router.get('/users', requireAuth, getUsers)
router.get('/users/:userId', requireAuth, getUserDetail)

export default router
