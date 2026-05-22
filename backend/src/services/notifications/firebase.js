import admin from 'firebase-admin'
import { eq } from 'drizzle-orm'
import { db } from '../../../db/index.js'
import { userDevices } from '../../../db/schema/userDevices.js'

let app = null

function getApp() {
  if (app) return app

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT
  if (!raw) {
    console.warn('FIREBASE_SERVICE_ACCOUNT is not set — push notifications disabled')
    return null
  }

  try {
    const credential = raw.startsWith('{')
      ? JSON.parse(raw)
      : JSON.parse(Buffer.from(raw, 'base64').toString('utf8'))

    app = admin.initializeApp({
      credential: admin.credential.cert(credential),
    })
    return app
  } catch (err) {
    console.error('Failed to initialise Firebase Admin:', err.message)
    return null
  }
}

async function pruneStaleTokens(tokens, responses) {
  const staleTokens = []
  responses.forEach((resp, i) => {
    if (
      resp.error &&
      (resp.error.code === 'messaging/registration-token-not-registered' ||
        resp.error.code === 'messaging/invalid-registration-token')
    ) {
      staleTokens.push(tokens[i])
    }
  })

  if (staleTokens.length === 0) return

  try {
    for (const token of staleTokens) {
      await db
        .update(userDevices)
        .set({ fcmToken: null })
        .where(eq(userDevices.fcmToken, token))
    }
  } catch (err) {
    console.error('Failed to prune stale FCM tokens:', err.message)
  }
}

export async function sendPushNotification(tokens, notification, data = {}) {
  if (!tokens || tokens.length === 0) return

  const firebaseApp = getApp()
  if (!firebaseApp) return

  try {
    const message = {
      notification,
      data,
      tokens,
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
          },
        },
      },
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          channelId: 'ohrny_high_importance_v2',
          priority: 'max',
        },
      },
    }

    const response = await admin.messaging().sendEachForMulticast(message)

    if (response.failureCount > 0) {
      pruneStaleTokens(tokens, response.responses)
    }
  } catch (err) {
    console.error('FCM sendEachForMulticast error:', err.message)
  }
}
