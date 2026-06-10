import { Router } from 'express'
import { requireAuth } from '../../middleware/admin/auth.js'
import {
  cancelUserSubscription,
  getUserDetail,
  getUsers,
  getUserSubscription,
  grantUserConsumables,
  grantUserSubscription,
} from '../../controllers/Admin/users.js'

const router = Router()

router.get('/users', requireAuth, getUsers)
router.get('/users/:userId', requireAuth, getUserDetail)
router.get('/users/:userId/subscription', requireAuth, getUserSubscription)
router.post('/users/:userId/subscription/grant', requireAuth, grantUserSubscription)
router.post('/users/:userId/subscription/cancel', requireAuth, cancelUserSubscription)
router.post('/users/:userId/consumables/grant', requireAuth, grantUserConsumables)

export default router
