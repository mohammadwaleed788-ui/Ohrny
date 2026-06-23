import { Router } from 'express'
import { requireAuth, requireRole } from '../../middleware/admin/auth.js'
import {
  createTeamMember,
  deactivateTeamMember,
  listTeamMembers,
  updateTeamMember,
} from '../../controllers/Admin/team.js'

const router = Router()

router.use(requireAuth, requireRole('super_admin'))

router.get('/team', listTeamMembers)
router.post('/team', createTeamMember)
router.patch('/team/:id', updateTeamMember)
router.delete('/team/:id', deactivateTeamMember)

export default router
