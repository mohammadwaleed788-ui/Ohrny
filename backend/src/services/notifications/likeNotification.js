import { and, eq } from 'drizzle-orm'
import { db } from '../../../db/index.js'
import { users, userPhotos } from '../../../db/schema/users.js'
import { getUserFcmTokens } from '../../controllers/User/device.js'
import { sendPushNotification } from './firebase.js'

// Returns { handle, mainPhotoKey, blurAmount } for a user, or null on failure.
async function fetchUserCard(userId) {
  try {
    const [row] = await db
      .select({ handle: users.handle })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)

    if (!row) return null

    const [photo] = await db
      .select({
        storageKey: userPhotos.storageKey,
        isBlurred: userPhotos.isBlurred,
        blurAmount: userPhotos.blurAmount,
      })
      .from(userPhotos)
      .where(and(eq(userPhotos.userId, userId), eq(userPhotos.isMain, true)))
      .limit(1)

    // If the photo is not blurred, send 0 so the match screen shows it clearly.
    const effectiveBlur = photo ? (photo.isBlurred ? photo.blurAmount : 0) : 70

    return {
      handle: row.handle,
      mainPhotoKey: photo?.storageKey ?? null,
      blurAmount: effectiveBlur,
    }
  } catch {
    return null
  }
}

export async function notifyPassed(toUserId, passedByUserId) {
  const card = await fetchUserCard(passedByUserId)

  const notification = {
    title: 'Not a match this time',
    body: card
      ? `${card.handle} passed on your like`
      : 'Someone passed on your like',
  }

  const data = {
    type: 'like_rejected',
    fromUserId: passedByUserId,
  }

  getUserFcmTokens(toUserId)
    .then((tokens) => sendPushNotification(tokens, notification, data))
    .catch((err) => console.error('notifyPassed failed:', err.message))
}

export async function notifyNewLike(toUserId, fromUserId, isSuperLike) {
  const type = isSuperLike ? 'new_super_like' : 'new_like'
  const card = await fetchUserCard(fromUserId)

  const notification = {
    title: isSuperLike ? 'New Super Like!' : 'New Like!',
    body: card
      ? `${card.handle} liked your profile`
      : 'Someone liked your profile',
  }

  // FCM data values must be strings.
  const data = {
    type,
    fromUserId,
    handle: card?.handle ?? '',
    mainPhotoKey: card?.mainPhotoKey ?? '',
    blurAmount: String(card?.blurAmount ?? 70),
  }

  getUserFcmTokens(toUserId)
    .then((tokens) => sendPushNotification(tokens, notification, data))
    .catch((err) => console.error('notifyNewLike failed:', err.message))
}

export async function notifyNewMatch(toUserId, matchedWithUserId) {
  const card = await fetchUserCard(matchedWithUserId)

  const notification = {
    title: "It's a Match!",
    body: card
      ? `You matched with ${card.handle}`
      : 'You matched with someone new',
  }

  // FCM data values must be strings.
  const data = {
    type: 'new_match',
    fromUserId: matchedWithUserId,
    handle: card?.handle ?? '',
    mainPhotoKey: card?.mainPhotoKey ?? '',
    blurAmount: String(card?.blurAmount ?? 70),
  }

  getUserFcmTokens(toUserId)
    .then((tokens) => sendPushNotification(tokens, notification, data))
    .catch((err) => console.error('notifyNewMatch failed:', err.message))
}
