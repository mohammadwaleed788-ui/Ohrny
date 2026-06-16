import { Router } from 'express'
import { requireAuth } from '../../middleware/user/auth.js'
import {
  listTravelLocations,
  addTravelLocation,
  deleteTravelLocation,
} from '../../controllers/User/travel.js'

const router = Router()

router.get('/travel-locations', requireAuth, listTravelLocations)
router.post('/travel-locations', requireAuth, addTravelLocation)
router.delete('/travel-locations/:id', requireAuth, deleteTravelLocation)

export default router
