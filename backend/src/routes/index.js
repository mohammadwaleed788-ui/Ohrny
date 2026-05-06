import { Router } from 'express'
import healthRoute from './health.route.js'
import staffAuthRoutes from './Admin/auth.js'
import memberAuthRoutes from './User/auth.js'

const router = Router()

router.use(healthRoute)
router.use('/admin', staffAuthRoutes)
router.use('/user', memberAuthRoutes)

export default router
