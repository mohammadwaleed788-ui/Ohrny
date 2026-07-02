import { getUserFcmTokens } from '../../controllers/User/device.js'
import { sendPushNotification } from './firebase.js'
import { localizedNotification } from './localized.js'

// Fire-and-forget: a plan member just received their weekly Super Like top-up.
export async function notifyWeeklySuperLikes(userId, count) {
  const n = Number(count) || 0
  if (n <= 0) return

  const notification = await localizedNotification(
    userId,
    { titleKey: 'weeklySuperLikes_title', bodyKey: 'weeklySuperLikes_body' },
    { count: n },
  )

  const data = {
    type: 'weekly_super_likes',
    count: String(n),
  }

  getUserFcmTokens(userId)
    .then((tokens) => sendPushNotification(tokens, notification, data))
    .catch((err) =>
      console.error('notifyWeeklySuperLikes failed:', err.message),
    )
}

// Fire-and-forget: a Platin/Private member just received their weekly free Boost.
export async function notifyWeeklyBoost(userId) {
  const notification = await localizedNotification(
    userId,
    { titleKey: 'weeklyBoost_title', bodyKey: 'weeklyBoost_body' },
  )

  const data = {
    type: 'weekly_boost',
  }

  getUserFcmTokens(userId)
    .then((tokens) => sendPushNotification(tokens, notification, data))
    .catch((err) => console.error('notifyWeeklyBoost failed:', err.message))
}
