import { and, eq, ne } from 'drizzle-orm'
import { db } from '../../../db/index.js'
import { userDevices } from '../../../db/schema/userDevices.js'

function isValidTimezone(timezone) {
  try {
    Intl.DateTimeFormat('en-US', { timeZone: timezone })
    return true
  } catch {
    return false
  }
}

export async function saveDevice(req, res) {
  try {
    const userId = req.user?.id
    const {
      deviceId,
      deviceName,
      devicePlatform,
      fcmToken,
      timezone = 'UTC',
    } = req.body || {}

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }
    if (!deviceId) {
      return res.status(400).json({ error: 'Device ID is required' })
    }
    if (!isValidTimezone(timezone)) {
      return res.status(400).json({ error: "Invalid timezone. Use IANA format like 'Asia/Karachi'" })
    }

    const [device] = await db
      .insert(userDevices)
      .values({
        userId,
        deviceId: String(deviceId),
        deviceName: deviceName ? String(deviceName) : null,
        devicePlatform: devicePlatform ? String(devicePlatform) : null,
        fcmToken: fcmToken ? String(fcmToken) : null,
        timezone: String(timezone),
        pushNotificationEnabled: true,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: userDevices.deviceId,
        set: {
          userId,
          deviceName: deviceName ? String(deviceName) : null,
          devicePlatform: devicePlatform ? String(devicePlatform) : null,
          fcmToken: fcmToken ? String(fcmToken) : null,
          timezone: String(timezone),
          updatedAt: new Date(),
        },
      })
      .returning()

    // A given FCM token belongs to exactly one device. If it was previously
    // registered under a different deviceId (e.g. reinstall), drop it from those
    // stale rows so we never push the same notification to one phone twice.
    if (fcmToken) {
      await db
        .update(userDevices)
        .set({ fcmToken: null, updatedAt: new Date() })
        .where(
          and(
            eq(userDevices.fcmToken, String(fcmToken)),
            ne(userDevices.deviceId, String(deviceId)),
          ),
        )
    }

    return res.json({ message: 'Device saved successfully', device })
  } catch (error) {
    console.error('Error saving device:', error)
    return res.status(500).json({ error: 'Failed to save device' })
  }
}

export async function getMyDevices(req, res) {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const devices = await db
      .select()
      .from(userDevices)
      .where(eq(userDevices.userId, userId))

    return res.json({ devices })
  } catch (error) {
    console.error('Error fetching devices:', error)
    return res.status(500).json({ error: 'Failed to fetch devices' })
  }
}

export async function updatePushStatus(req, res) {
  try {
    const userId = req.user?.id
    const { deviceId } = req.params
    const { enabled } = req.body || {}

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ error: 'Enabled must be a boolean' })
    }

    const [device] = await db
      .update(userDevices)
      .set({
        pushNotificationEnabled: enabled,
        updatedAt: new Date(),
      })
      .where(and(eq(userDevices.deviceId, deviceId), eq(userDevices.userId, userId)))
      .returning()

    if (!device) {
      return res.status(404).json({ error: 'Device not found' })
    }

    return res.json({ message: 'Push status updated', device })
  } catch (error) {
    console.error('Error updating push status:', error)
    return res.status(500).json({ error: 'Failed to update push status' })
  }
}

export async function updateDeviceTimezone(req, res) {
  try {
    const userId = req.user?.id
    const { deviceId } = req.params
    const { timezone } = req.body || {}

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }
    if (!timezone) {
      return res.status(400).json({ error: 'Timezone is required' })
    }
    if (!isValidTimezone(timezone)) {
      return res.status(400).json({ error: "Invalid timezone. Use IANA format like 'Asia/Karachi'" })
    }

    const [device] = await db
      .update(userDevices)
      .set({
        timezone: String(timezone),
        updatedAt: new Date(),
      })
      .where(and(eq(userDevices.deviceId, deviceId), eq(userDevices.userId, userId)))
      .returning()

    if (!device) {
      return res.status(404).json({ error: 'Device not found' })
    }

    return res.json({ message: 'Timezone updated successfully', device })
  } catch (error) {
    console.error('Error updating timezone:', error)
    return res.status(500).json({ error: 'Failed to update timezone' })
  }
}

export async function updateDeviceFcmToken(req, res) {
  try {
    const userId = req.user?.id
    const { deviceId } = req.params
    const { fcmToken } = req.body || {}

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }
    if (!fcmToken) {
      return res.status(400).json({ error: 'FCM token is required' })
    }

    const [device] = await db
      .update(userDevices)
      .set({
        fcmToken: String(fcmToken),
        updatedAt: new Date(),
      })
      .where(and(eq(userDevices.deviceId, deviceId), eq(userDevices.userId, userId)))
      .returning()

    if (!device) {
      return res.status(404).json({ error: 'Device not found' })
    }

    return res.json({ message: 'FCM token updated', device })
  } catch (error) {
    console.error('Error updating FCM token:', error)
    return res.status(500).json({ error: 'Failed to update FCM token' })
  }
}

export async function removeDevice(req, res) {
  try {
    const userId = req.user?.id
    const { deviceId } = req.params

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const [deletedDevice] = await db
      .delete(userDevices)
      .where(and(eq(userDevices.userId, userId), eq(userDevices.deviceId, deviceId)))
      .returning()

    if (!deletedDevice) {
      return res.status(404).json({ error: 'Device not found' })
    }

    return res.json({ message: 'Device removed successfully', device: deletedDevice })
  } catch (error) {
    console.error('Error removing device:', error)
    return res.status(500).json({ error: 'Failed to remove device' })
  }
}

export async function getDeviceById(req, res) {
  try {
    const userId = req.user?.id
    const { deviceId } = req.params

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const [device] = await db
      .select()
      .from(userDevices)
      .where(and(eq(userDevices.userId, userId), eq(userDevices.deviceId, deviceId)))
      .limit(1)

    if (!device) {
      return res.status(404).json({ error: 'Device not found' })
    }

    return res.json({ device })
  } catch (error) {
    console.error('Error fetching device:', error)
    return res.status(500).json({ error: 'Failed to fetch device' })
  }
}

export async function getUserFcmTokens(userId) {
  try {
    const devices = await db
      .select({ fcmToken: userDevices.fcmToken })
      .from(userDevices)
      .where(and(eq(userDevices.userId, userId), eq(userDevices.pushNotificationEnabled, true)))

    // De-duplicate: the same FCM token can sit on multiple device rows (e.g. a
    // reinstall changes the deviceId but keeps/refreshes the same token), which
    // would otherwise send the same push 2–4× to one phone.
    const tokens = devices
      .map((device) => device.fcmToken)
      .filter((token) => token !== null && token !== '')
    return [...new Set(tokens)]
  } catch (error) {
    console.error('Error getting user FCM tokens:', error)
    return []
  }
}
