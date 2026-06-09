import { and, eq } from 'drizzle-orm'
import { db } from '../../../db/index.js'
import { users } from '../../../db/schema/users.js'
import { userSubscriptions } from '../../../db/schema/subscriptions.js'
import { REVENUECAT_WEBHOOK_SECRET } from '../../config/constants.js'
import {
  findSubscriptionProductByRevenueCatId,
  grantPurchase,
  seedSubscriptionCatalog,
  syncUserPlanCache,
} from '../../services/entitlementService.js'

// Ordered LARGEST-first: `super.*5` also matches "15"/"30", so the bigger,
// more-specific packs must be tested before the smaller ones.
const PURCHASE_PACKS = [
  { match: /super.*30|30.*super/i, type: 'super_likes', quantity: 30 },
  { match: /super.*15|15.*super/i, type: 'super_likes', quantity: 15 },
  { match: /super.*5|5.*super/i, type: 'super_likes', quantity: 5 },
  { match: /boost.*10|10.*boost/i, type: 'boosts', quantity: 10 },
  { match: /boost.*5|5.*boost/i, type: 'boosts', quantity: 5 },
  { match: /boost.*1|1.*boost/i, type: 'boosts', quantity: 1 },
]

function eventFromPayload(payload) {
  return payload?.event || payload
}

function normalizePlatform(value) {
  const raw = String(value || '').toLowerCase()
  if (raw.includes('android') || raw.includes('play')) return 'android'
  if (raw.includes('web')) return 'web'
  return 'ios'
}

function normalizePurchase(productId) {
  const raw = String(productId || '')
  return PURCHASE_PACKS.find((pack) => pack.match.test(raw)) || null
}

function normalizeStatus(eventType) {
  const type = String(eventType || '').toUpperCase()
  if (['CANCELLATION', 'EXPIRATION', 'BILLING_ISSUE'].includes(type)) {
    return type === 'BILLING_ISSUE' ? 'grace_period' : type === 'CANCELLATION' ? 'cancelled' : 'expired'
  }
  if (type === 'TRANSFER') return 'cancelled'
  return 'active'
}

function dateFromMs(value) {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? new Date(n) : null
}

async function findUser(appUserId) {
  if (!appUserId) return null
  const [byRevenueCat] = await db
    .select({ id: users.id, revenueCatUserId: users.revenueCatUserId })
    .from(users)
    .where(eq(users.revenueCatUserId, appUserId))
    .limit(1)
  if (byRevenueCat) return byRevenueCat

  const [byId] = await db
    .select({ id: users.id, revenueCatUserId: users.revenueCatUserId })
    .from(users)
    .where(eq(users.id, appUserId))
    .limit(1)
  return byId || null
}

export async function handleRevenueCatWebhook(req, res) {
  try {
    if (REVENUECAT_WEBHOOK_SECRET) {
      const headerSecret = req.get('authorization') || req.get('Authorization') || ''
      const token = headerSecret.replace(/^Bearer\s+/i, '')
      if (token !== REVENUECAT_WEBHOOK_SECRET) {
        return res.status(401).json({ error: 'Unauthorized' })
      }
    }

    await seedSubscriptionCatalog()

    const event = eventFromPayload(req.body)
    const appUserId = event.app_user_id || event.appUserId || event.original_app_user_id
    const user = await findUser(appUserId)
    if (!user) return res.status(202).json({ ok: true, ignored: 'user_not_found' })
    if (appUserId && !user.revenueCatUserId) {
      await db
        .update(users)
        .set({ revenueCatUserId: appUserId, updatedAt: new Date() })
        .where(eq(users.id, user.id))
    }

    const productId = event.product_id || event.productId || event.product_identifier
    const entitlementId = event.entitlement_id || event.entitlementId || event.entitlement_identifier
    const transactionId = event.transaction_id || event.transactionId || event.original_transaction_id
    const platform = normalizePlatform(event.store || event.platform)
    const price = event.price || event.price_in_purchased_currency || event.priceInPurchasedCurrency || 0
    const currency = event.currency || event.currency_code || 'EUR'
    const purchasedAt = dateFromMs(event.purchased_at_ms) || dateFromMs(event.event_timestamp_ms) || new Date()

    const consumable = normalizePurchase(productId)
    if (consumable) {
      const result = await grantPurchase({
        userId: user.id,
        type: consumable.type,
        quantity: consumable.quantity,
        priceAtPurchase: price,
        currency,
        revenueCatProductId: productId,
        revenueCatTransactionId: transactionId,
        platform,
        purchasedAt,
      })
      return res.json({ ok: true, type: 'purchase', duplicate: Boolean(result.duplicate) })
    }

    const product = await findSubscriptionProductByRevenueCatId(productId)
    if (!product) {
      return res.status(202).json({ ok: true, ignored: 'unknown_product' })
    }
    const planId = product.planId

    const status = normalizeStatus(event.type || event.event_type)
    const now = new Date()
    const startedAt = purchasedAt || now
    const expiresAt = dateFromMs(event.expiration_at_ms) || dateFromMs(event.expires_at_ms)
    const cancelledAt = status === 'cancelled' ? now : null
    const gracePeriodEndsAt = status === 'grace_period' ? expiresAt : null

    await db.transaction(async (tx) => {
      if (status === 'active' || status === 'grace_period') {
        await tx
          .update(userSubscriptions)
          .set({ status: 'expired', updatedAt: now })
          .where(and(eq(userSubscriptions.userId, user.id), eq(userSubscriptions.status, 'active')))
      }

      const row = {
        userId: user.id,
        planId,
        productId: product.id,
        revenueCatProductId: productId || null,
        duration: product.duration || null,
        revenueCatPurchaseToken: event.original_transaction_id || transactionId || null,
        revenueCatEntitlementId: entitlementId || null,
        revenueCatTransactionId: transactionId || null,
        status,
        platform,
        priceAtPurchase: String(price || 0),
        currency,
        startedAt,
        expiresAt,
        cancelledAt,
        gracePeriodEndsAt,
        rawWebhookPayload: req.body,
        updatedAt: now,
      }

      if (transactionId) {
        const [existing] = await tx
          .select({ id: userSubscriptions.id })
          .from(userSubscriptions)
          .where(eq(userSubscriptions.revenueCatTransactionId, transactionId))
          .limit(1)

        if (existing) {
          await tx.update(userSubscriptions).set(row).where(eq(userSubscriptions.id, existing.id))
        } else {
          await tx.insert(userSubscriptions).values(row)
        }
      } else {
        await tx.insert(userSubscriptions).values(row)
      }

      await syncUserPlanCache(user.id, tx)
    })

    return res.json({ ok: true, type: 'subscription', plan: planId, status })
  } catch (err) {
    console.error('RevenueCat webhook error:', err)
    return res.status(500).json({ error: 'Failed to process webhook' })
  }
}
