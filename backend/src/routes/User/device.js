import { Router } from 'express'
import { requireAuth } from '../../middleware/user/auth.js'
import {
  saveDevice,
  getMyDevices,
  updatePushStatus,
  updateDeviceTimezone,
  updateDeviceFcmToken,
  removeDevice,
  getDeviceById,
} from '../../controllers/User/device.js'

const router = Router()

router.post('/', requireAuth, saveDevice)
router.get('/', requireAuth, getMyDevices)
router.patch('/:deviceId/push-status', requireAuth, updatePushStatus)
router.patch('/:deviceId/timezone', requireAuth, updateDeviceTimezone)
router.patch('/:deviceId/fcm-token', requireAuth, updateDeviceFcmToken)
router.delete('/:deviceId', requireAuth, removeDevice)
router.get('/:deviceId', requireAuth, getDeviceById)

export default router
