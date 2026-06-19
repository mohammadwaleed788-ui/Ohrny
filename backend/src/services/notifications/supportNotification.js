import { getUserFcmTokens } from '../../controllers/User/device.js'
import { sendPushNotification } from './firebase.js'

// Fire-and-forget: a support agent replied to the user's ticket. Carries the
// ticketId so the app can deep-link straight to that ticket on tap.
export async function notifySupportReply(userId, { ticketId, ticketNo, body } = {}) {
  if (!userId || !ticketId) return

  const preview = String(body || '').replace(/\s+/g, ' ').trim()
  const notification = {
    title: 'Support replied',
    body: preview.length > 120 ? `${preview.slice(0, 117)}…` : (preview || 'You have a new reply on your ticket'),
  }

  const data = {
    type: 'support_reply',
    ticketId,
    ticketNo: ticketNo || '',
  }

  getUserFcmTokens(userId)
    .then((tokens) => sendPushNotification(tokens, notification, data))
    .catch((err) => console.error('notifySupportReply failed:', err.message))
}
