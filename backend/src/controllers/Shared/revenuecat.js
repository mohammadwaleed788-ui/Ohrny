import { and, eq } from 'drizzle-orm'
import { db } from '../../../db/index.js'
import { users } from '../../../db/schema/users.js'
import { billingEvents, userSubscriptions } from '../../../db/schema/subscriptions.js'
import { REVENUECAT_WEBHOOK_SECRET } from '../../config/constants.js'
import {
  PLAN_ORDER,
  findSubscriptionProductByRevenueCatId,
  grantPurchase,
  normalizeConsumableProduct,
  seedSubscriptionCatalog,
  syncUserPlanCache,
  topUpSuperLikesForPlan,
} from '../../services/entitlementService.js'

function eventFromPayload(payload) {
  return payload?.event || payload
}

function normalizePlatform(value) {
  const raw = String(value || '').toLowerCase()
  if (raw.includes('android') || raw.includes('play')) return 'android'
  if (raw.includes('web')) return 'web'
  return 'ios'
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

function toUpper(value) {
  return String(value || '').toUpperCase()
}

function normalizeConsumableType(productId) {
  const raw = String(productId || '').toLowerCase()
  if (!raw) return null
  if (raw.includes('super')) return 'super_likes'
  if (raw.includes('boost')) return 'boosts'
  if (raw.includes('read') && raw.includes('receipt')) return 'read_receipts'
  if (raw.includes('rewind')) return 'rewind'
  if (raw.includes('incognito')) return 'incognito'
  return null
}

function mapBillingEventType(event) {
  const type = toUpper(event.type || event.event_type)
  const periodType = toUpper(event.period_type || event.periodType)
  const prevPeriodType = toUpper(event.original_period_type || event.originalPeriodType)

  if (type === 'REFUND') return { eventType: 'refund', metricKind: 'refund' }
  if (type === 'CANCELLATION') return { eventType: 'subscription_cancelled', metricKind: 'subscription' }
  if (type === 'EXPIRATION') return { eventType: 'subscription_expired', metricKind: 'subscription' }
  if (type === 'RENEWAL' && (prevPeriodType === 'TRIAL' || event.is_trial_conversion === true)) {
    return { eventType: 'trial_converted', metricKind: 'trial' }
  }
  if (type === 'INITIAL_PURCHASE' && periodType === 'TRIAL') {
    return { eventType: 'trial_started', metricKind: 'trial' }
  }
  if (type === 'RENEWAL') return { eventType: 'subscription_renewed', metricKind: 'subscription' }
  if (type === 'INITIAL_PURCHASE' || type === 'PRODUCT_CHANGE') {
    return { eventType: 'subscription_started', metricKind: 'subscription' }
  }
  return null
}

async function logBillingEvent({
  userId,
  mappedType,
  amount,
  currency,
  occurredAt,
  productId,
  transactionId,
  planId = null,
  consumableType = null,
  payload = null,
  eventTypeRaw = null,
}) {
  if (!mappedType) return

  try {
    await db.insert(billingEvents).values({
      userId,
      eventType: mappedType.eventType,
      metricKind: mappedType.metricKind,
      consumableType,
      planId,
      amount: String(amount || 0),
      currency: currency || 'EUR',
      occurredAt: occurredAt || new Date(),
      source: 'revenuecat',
      revenueCatEventType: eventTypeRaw,
      revenueCatProductId: productId || null,
      revenueCatTransactionId: transactionId || null,
      payload,
    })
  } catch (err) {
    const message = String(err?.message || '')
    if (message.includes('billing_events') || message.includes('does not exist')) {
      return
    }
    throw err
  }
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
    // RevenueCat sends `entitlement_ids` (array, e.g. ["plus"]/["platin"]); the
    // singular `entitlement_id` is deprecated and often null — read both.
    const entitlementIds = Array.isArray(event.entitlement_ids)
      ? event.entitlement_ids
      : []
    const entitlementId =
      event.entitlement_id ||
      event.entitlementId ||
      event.entitlement_identifier ||
      entitlementIds[0] ||
      null
    const transactionId = event.transaction_id || event.transactionId || event.original_transaction_id
    const platform = normalizePlatform(event.store || event.platform)
    const price = event.price || event.price_in_purchased_currency || event.priceInPurchasedCurrency || 0
    const currency = event.currency || event.currency_code || 'EUR'
    const purchasedAt = dateFromMs(event.purchased_at_ms) || dateFromMs(event.event_timestamp_ms) || new Date()

    const consumable = normalizeConsumableProduct(productId)
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
      await logBillingEvent({
        userId: user.id,
        mappedType: { eventType: 'consumable_purchase', metricKind: 'consumable' },
        amount: Number(price || 0),
        currency,
        occurredAt: purchasedAt,
        productId,
        transactionId,
        consumableType: consumable.type,
        payload: req.body,
        eventTypeRaw: event.type || event.event_type || null,
      })
      return res.json({ ok: true, type: 'purchase', duplicate: Boolean(result.duplicate) })
    }

    // Resolve the plan: prefer the seeded product map (by RevenueCat product
    // id), and fall back to the entitlement id (plus / platin) so a purchase
    // still grants the right plan even if that exact product id wasn't seeded.
    const product = await findSubscriptionProductByRevenueCatId(productId)
    const entitlementPlan = [entitlementId, ...entitlementIds].find(
      (e) => PLAN_ORDER.includes(e) && e !== 'free',
    )
    const planId = product?.planId || entitlementPlan || null
    if (!planId) {
      return res.status(202).json({ ok: true, ignored: 'unknown_product' })
    }

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
        productId: product?.id || null,
        revenueCatProductId: productId || null,
        duration: product?.duration || null,
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
      // Give a new/renewing subscriber their weekly Super Likes immediately
      // (the cron then refreshes them every Monday).
      if (status === 'active' || status === 'grace_period') {
        await topUpSuperLikesForPlan(user.id, tx)
      }
    })

    const mappedType = mapBillingEventType(event)
    const fallbackConsumableType = normalizeConsumableType(productId)
    const refundAmount = mappedType?.eventType === 'refund' ? -Math.abs(Number(price || 0)) : Number(price || 0)
    await logBillingEvent({
      userId: user.id,
      mappedType,
      amount: refundAmount,
      currency,
      occurredAt: startedAt,
      productId,
      transactionId,
      planId,
      consumableType: fallbackConsumableType,
      payload: req.body,
      eventTypeRaw: event.type || event.event_type || null,
    })

    return res.json({ ok: true, type: 'subscription', plan: planId, status })
  } catch (err) {
    console.error('RevenueCat webhook error:', err)
    return res.status(500).json({ error: 'Failed to process webhook' })
  }
}
