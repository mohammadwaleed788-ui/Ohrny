import { getUserFcmTokens } from '../../controllers/User/device.js'
import { sendPushNotification } from './firebase.js'
import { localizedNotification } from './localized.js'

export async function notifyNewMessage(recipientId, senderHandle, matchId) {
  const handle = senderHandle || 'Someone'

  const notification = await localizedNotification(
    recipientId,
    { titleKey: 'newMessage_title', bodyKey: 'newMessage_body' },
    { handle },
  )

  const data = {
    type: 'new_message',
    matchId,
    senderHandle: handle,
  }

  getUserFcmTokens(recipientId)
    .then((tokens) => sendPushNotification(tokens, notification, data))
    .catch((err) => console.error('notifyNewMessage failed:', err.message))
}

export async function notifyPhotoUnlockRequest(recipientId, senderHandle, matchId) {
  const handle = senderHandle || 'Someone'

  const notification = await localizedNotification(
    recipientId,
    { titleKey: 'photoUnlock_title', bodyKey: 'photoUnlock_body' },
    { handle },
  )

  const data = {
    type: 'photo_unlock_request',
    senderHandle: handle,
    matchId: matchId ?? '',
  }

  getUserFcmTokens(recipientId)
    .then((tokens) => sendPushNotification(tokens, notification, data))
    .catch((err) => console.error('notifyPhotoUnlockRequest failed:', err.message))
}

export async function notifyIncomingCall(recipientId, callerHandle, callType, { callId, matchId } = {}) {
  const handle = callerHandle || 'Someone'
  const label = callType === 'video' ? 'video' : 'voice'

  const notification = await localizedNotification(
    recipientId,
    {
      titleKey: label === 'video' ? 'incomingCallVideo_title' : 'incomingCallVoice_title',
      bodyKey: 'incomingCall_body',
    },
    { handle },
  )

  const data = {
    type: 'incoming_call',
    callerHandle: handle,
    callType: label,
    callId: callId ?? '',
    matchId: matchId ?? '',
  }

  getUserFcmTokens(recipientId)
    .then((tokens) => sendPushNotification(tokens, notification, data))
    .catch((err) => console.error('notifyIncomingCall failed:', err.message))
}
