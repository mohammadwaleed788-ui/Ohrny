import { Router } from 'express'
import healthRoute from './health.route.js'
import staffAuthRoutes from './Admin/auth.js'
import adminOverviewRoutes from './Admin/overview.js'
import adminMatchesRoutes from './Admin/matches.js'
import adminUsersRoutes from './Admin/users.js'
import adminOperatedRoutes from './Admin/operated.js'
import memberAuthRoutes from './User/auth.js'
import memberS3Routes from './User/s3.js'
import memberDeviceRoutes from './User/device.js'
import memberPhotoRoutes from './User/photo.js'
import memberDiscoverRoutes from './User/discover.js'
import memberLikesRoutes from './User/likes.js'
import memberChatRoutes from './User/chat.js'
import memberActivityRoutes from './User/activity.js'
import memberSafetyRoutes from './User/safety.js'
import memberEntitlementRoutes from './User/entitlements.js'
import memberBoostRoutes from './User/boosts.js'
import memberTravelRoutes from './User/travel.js'
import revenueCatRoutes from './Shared/revenuecat.js'

const router = Router()

router.use(healthRoute)
router.use(revenueCatRoutes)
router.use('/admin', staffAuthRoutes)
router.use('/admin', adminOverviewRoutes)
router.use('/admin', adminMatchesRoutes)
router.use('/admin', adminUsersRoutes)
router.use('/admin/operated', adminOperatedRoutes)
router.use('/user', memberAuthRoutes)
router.use('/user', memberS3Routes)
router.use('/user', memberDiscoverRoutes)
router.use('/user', memberLikesRoutes)
router.use('/user', memberChatRoutes)
router.use('/user', memberActivityRoutes)
router.use('/user', memberSafetyRoutes)
router.use('/user', memberEntitlementRoutes)
router.use('/user', memberBoostRoutes)
router.use('/user', memberTravelRoutes)
router.use('/user/devices', memberDeviceRoutes)
router.use('/user/photos', memberPhotoRoutes)

export default router
