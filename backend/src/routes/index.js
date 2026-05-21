import { Router } from 'express'
import healthRoute from './health.route.js'
import staffAuthRoutes from './Admin/auth.js'
import adminOverviewRoutes from './Admin/overview.js'
import memberAuthRoutes from './User/auth.js'
import memberS3Routes from './User/s3.js'
import memberDeviceRoutes from './User/device.js'
import memberPhotoRoutes from './User/photo.js'
import memberDiscoverRoutes from './User/discover.js'
import memberLikesRoutes from './User/likes.js'
import memberChatRoutes from './User/chat.js'
import memberActivityRoutes from './User/activity.js'
import memberSafetyRoutes from './User/safety.js'

const router = Router()

router.use(healthRoute)
router.use('/admin', staffAuthRoutes)
router.use('/admin', adminOverviewRoutes)
router.use('/user', memberAuthRoutes)
router.use('/user', memberS3Routes)
router.use('/user', memberDiscoverRoutes)
router.use('/user', memberLikesRoutes)
router.use('/user', memberChatRoutes)
router.use('/user', memberActivityRoutes)
router.use('/user', memberSafetyRoutes)
router.use('/user/devices', memberDeviceRoutes)
router.use('/user/photos', memberPhotoRoutes)

export default router
