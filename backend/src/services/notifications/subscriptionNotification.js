import { getUserFcmTokens } from '../../controllers/User/device.js'
import { sendPushNotification } from './firebase.js'

// Fire-and-forget: a plan member just received their weekly Super Like top-up.
export async function notifyWeeklySuperLikes(userId, count) {
  const n = Number(count) || 0
  if (n <= 0) return

  const notification = {
    title: 'Your weekly Super Likes are here 💫',
    body: `You've got ${n} Super Like${n === 1 ? '' : 's'} to use this week.`,
  }

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
  const notification = {
    title: 'Your weekly Boost is ready 🚀',
    body: 'Activate it to jump to the top of the deck for 30 minutes.',
  }

  const data = {
    type: 'weekly_boost',
  }

  getUserFcmTokens(userId)
    .then((tokens) => sendPushNotification(tokens, notification, data))
    .catch((err) => console.error('notifyWeeklyBoost failed:', err.message))
}
