import {
  getActiveSubscriptionProductsGrouped,
  getEffectiveEntitlements,
  grantPurchase,
  normalizeConsumableProduct,
  syncSubscriptionFromRevenueCat,
} from '../../services/entitlementService.js'

// Client-confirm fallback for one-time purchases (Boosts / Super Likes). The
// app calls this right after a successful RevenueCat purchase so the balance is
// credited immediately instead of waiting on the async webhook (which can lag
// or, rarely, drop). grantPurchase dedupes by transaction id, so this and the
// webhook are safe to both run — whichever lands first wins.
export async function syncConsumablePurchase(req, res) {
  try {
    const { productId, transactionId, price, currency, platform } = req.body || {}
    if (!productId || !transactionId) {
      return res.status(400).json({ error: 'productId and transactionId are required' })
    }

    const consumable = normalizeConsumableProduct(productId)
    if (!consumable) {
      // Subscriptions are credited by the webhook, not here.
      return res.json({ ok: true, ignored: 'not_consumable' })
    }

    const result = await grantPurchase({
      userId: req.user.id,
      type: consumable.type,
      quantity: consumable.quantity,
      priceAtPurchase: price ?? 0,
      currency: currency || 'EUR',
      revenueCatProductId: productId,
      revenueCatTransactionId: transactionId,
      platform: platform || 'ios',
    })

    const entitlements = await getEffectiveEntitlements(req.user.id)
    return res.json({
      ok: true,
      duplicate: Boolean(result.duplicate),
      entitlements,
    })
  } catch (err) {
    console.error('syncConsumablePurchase error:', err)
    return res.status(500).json({ error: 'Failed to sync purchase' })
  }
}

// Client-confirm for SUBSCRIPTIONS. The app calls this right after a successful
// RevenueCat subscription purchase so premium unlocks immediately, instead of
// waiting on the async webhook (which can lag or, rarely, drop). The backend
// verifies the entitlement directly with RevenueCat's REST API — the client
// can't fake a plan — then returns fresh entitlements. Safe to run alongside the
// webhook: whichever lands first wins and the other reconciles.
export async function syncSubscriptionPurchase(req, res) {
  try {
    const result = await syncSubscriptionFromRevenueCat(req.user.id)
    const entitlements = await getEffectiveEntitlements(req.user.id)
    // `not_configured` (no RC secret key) isn't a client error — the webhook is
    // still the source of truth; just hand back current entitlements.
    return res.json({
      ok: result.ok,
      synced: result.ok && result.granted === true,
      reason: result.reason || null,
      plan: result.plan || entitlements?.plan || 'free',
      entitlements,
    })
  } catch (err) {
    console.error('syncSubscriptionPurchase error:', err)
    return res.status(500).json({ error: 'Failed to sync subscription' })
  }
}

export async function getEntitlements(req, res) {
  try {
    const entitlements = await getEffectiveEntitlements(req.user.id)
    if (!entitlements) return res.status(404).json({ error: 'User not found' })
    return res.json(entitlements)
  } catch (err) {
    console.error('getEntitlements error:', err)
    return res.status(500).json({ error: 'Failed to load entitlements' })
  }
}

export async function getSubscriptionProducts(req, res) {
  try {
    const requestedPlatform = String(req.query.platform || '').toLowerCase()
    const platform = ['ios', 'android', 'web'].includes(requestedPlatform) ? requestedPlatform : null
    const products = await getActiveSubscriptionProductsGrouped(platform)
    return res.json({ products })
  } catch (err) {
    console.error('getSubscriptionProducts error:', err)
    return res.status(500).json({ error: 'Failed to load subscription products' })
  }
}
