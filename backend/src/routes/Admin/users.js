import { Router } from 'express'
import { requireAuth, requireTab } from '../../middleware/admin/auth.js'
import {
  cancelUserSubscription,
  getUserDetail,
  getUsers,
  getUserSubscription,
  grantUserConsumables,
  grantUserSubscription,
} from '../../controllers/Admin/users.js'

const router = Router()

const usersTab = requireTab('users')

router.get('/users', requireAuth, usersTab, getUsers)
router.get('/users/:userId', requireAuth, usersTab, getUserDetail)
router.get('/users/:userId/subscription', requireAuth, usersTab, getUserSubscription)
router.post('/users/:userId/subscription/grant', requireAuth, usersTab, grantUserSubscription)
router.post('/users/:userId/subscription/cancel', requireAuth, usersTab, cancelUserSubscription)
router.post('/users/:userId/consumables/grant', requireAuth, usersTab, grantUserConsumables)

export default router
