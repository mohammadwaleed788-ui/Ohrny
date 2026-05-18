import { getUserFcmTokens } from '../../controllers/User/device.js'
import { sendPushNotification } from './firebase.js'

export function notifyNewLike(toUserId, isSuperLike) {
  const notification = {
    title: isSuperLike ? 'New Super Like!' : 'New Like!',
    body: 'Someone liked your profile',
  }

  const data = {
    type: 'new_like',
    screen: 'likes',
  }

  getUserFcmTokens(toUserId)
    .then((tokens) => sendPushNotification(tokens, notification, data))
    .catch((err) => console.error('notifyNewLike failed:', err.message))
}

export function notifyNewMatch(toUserId) {
  const notification = {
    title: "It's a Match!",
    body: 'You matched with someone new',
  }

  const data = {
    type: 'new_match',
    screen: 'matches',
  }

  getUserFcmTokens(toUserId)
    .then((tokens) => sendPushNotification(tokens, notification, data))
    .catch((err) => console.error('notifyNewMatch failed:', err.message))
}
