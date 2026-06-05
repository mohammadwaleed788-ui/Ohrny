import { getActiveSubscriptionProductsGrouped, getEffectiveEntitlements } from '../../services/entitlementService.js'

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
