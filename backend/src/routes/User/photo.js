import { Router } from 'express'
import { requireAuth } from '../../middleware/user/auth.js'
import { deletePhoto } from '../../controllers/User/photo.js'

const router = Router()

router.delete('/:id', requireAuth, deletePhoto)

export default router
