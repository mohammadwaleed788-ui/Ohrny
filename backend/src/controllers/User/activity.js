import { db } from '../../../db/index.js'
import { activityEvents } from '../../../db/schema/activity.js'

const VALID_EVENTS = ['app_open', 'swipe_start', 'session_end']

export async function logActivity(req, res) {
  try {
    const { event, platform } = req.body
    const userId = req.user.id

    if (!event || !VALID_EVENTS.includes(event)) {
      return res.status(400).json({ error: `Invalid event. Must be one of: ${VALID_EVENTS.join(', ')}` })
    }

    await db.insert(activityEvents).values({
      userId,
      event,
      platform: platform || null,
    })

    return res.json({ ok: true })
  } catch (err) {
    console.error('Activity log error:', err)
    return res.status(500).json({ error: 'Failed to log activity' })
  }
}
