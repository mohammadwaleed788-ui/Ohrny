import { Router } from 'express'
import { requireAuth } from '../../middleware/admin/auth.js'
import {
  createPersona,
  createPersonaSession,
  deletePersona,
  getPersona,
  getPersonaStats,
  listPersonas,
  updatePersona,
  updatePersonaStatus,
} from '../../controllers/Admin/operated.js'

const router = Router()

router.use(requireAuth)

router.get('/personas', listPersonas)
router.post('/personas', createPersona)
router.get('/personas/:userId', getPersona)
router.patch('/personas/:userId', updatePersona)
router.delete('/personas/:userId', deletePersona)
router.patch('/personas/:userId/status', updatePersonaStatus)
router.post('/personas/:userId/session', createPersonaSession)
router.get('/personas/:userId/stats', getPersonaStats)

export default router
