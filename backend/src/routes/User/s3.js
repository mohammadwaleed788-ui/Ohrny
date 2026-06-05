import express, { Router } from 'express'
import { requireAuth } from '../../middleware/user/auth.js'
import { generateSignedUrlForUserImage, uploadUserImage } from '../../controllers/User/s3.js'

const router = Router()

router.post('/s3/generate-signed-url-image', requireAuth, generateSignedUrlForUserImage)
router.post('/s3/upload-image', requireAuth, express.raw({ type: 'image/*', limit: '12mb' }), uploadUserImage)

export default router
