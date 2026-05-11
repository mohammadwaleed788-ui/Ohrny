import { Router } from 'express'
import { requireAuth } from '../../middleware/user/auth.js'
import { generateSignedUrlForUserImage } from '../../controllers/User/s3.js'

const router = Router()

router.post('/s3/generate-signed-url-image', requireAuth, generateSignedUrlForUserImage)

export default router
