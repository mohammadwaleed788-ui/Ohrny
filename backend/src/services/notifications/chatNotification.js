import { getUserFcmTokens } from '../../controllers/User/device.js'
import { sendPushNotification } from './firebase.js'

export async function notifyNewMessage(recipientId, senderHandle, matchId) {
  const handle = senderHandle || 'Someone'

  const notification = {
    title: 'New message',
    body: `${handle} sent you a message`,
  }

  const data = {
    type: 'new_message',
    matchId,
    senderHandle: handle,
  }

  getUserFcmTokens(recipientId)
    .then((tokens) => sendPushNotification(tokens, notification, data))
    .catch((err) => console.error('notifyNewMessage failed:', err.message))
}

export async function notifyPhotoUnlockRequest(recipientId, senderHandle) {
  const handle = senderHandle || 'Someone'

  const notification = {
    title: 'Photo unlock request',
    body: `${handle} wants to unlock photos with you`,
  }

  const data = {
    type: 'photo_unlock_request',
    senderHandle: handle,
  }

  getUserFcmTokens(recipientId)
    .then((tokens) => sendPushNotification(tokens, notification, data))
    .catch((err) => console.error('notifyPhotoUnlockRequest failed:', err.message))
}

export async function notifyIncomingCall(recipientId, callerHandle, callType) {
  const handle = callerHandle || 'Someone'
  const label = callType === 'video' ? 'video' : 'voice'

  const notification = {
    title: `Incoming ${label} call`,
    body: `${handle} is calling you`,
  }

  const data = {
    type: 'incoming_call',
    callerHandle: handle,
    callType: label,
  }

  getUserFcmTokens(recipientId)
    .then((tokens) => sendPushNotification(tokens, notification, data))
    .catch((err) => console.error('notifyIncomingCall failed:', err.message))
}
