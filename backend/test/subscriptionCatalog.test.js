import test from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_PLAN_CONFIGS, DEFAULT_PRODUCT_CONFIGS, DURATION_ORDER } from '../src/services/entitlementService.js'

const PAID_PLANS = ['plus', 'platin']
const PLATFORMS = ['ios', 'android']

function productFor(planId, platform, duration) {
  return DEFAULT_PRODUCT_CONFIGS.find(
    (row) => row.planId === planId && row.platform === platform && row.duration === duration,
  )
}

test('default paid SKU catalog covers all duration/platform combinations', () => {
  assert.equal(DEFAULT_PRODUCT_CONFIGS.length, PAID_PLANS.length * PLATFORMS.length * DURATION_ORDER.length)

  for (const planId of PAID_PLANS) {
    for (const platform of PLATFORMS) {
      for (const duration of DURATION_ORDER) {
        const row = productFor(planId, platform, duration)
        assert.ok(row, `missing SKU for ${planId}/${platform}/${duration}`)
        assert.equal(row.isActive, true)
        assert.equal(typeof row.revenueCatProductId, 'string')
        assert.equal(row.revenueCatProductId, `ohrny_${planId}_${duration}_${platform}`)
      }
    }
  }
})

test('default SKU IDs are unique for deterministic webhook mapping', () => {
  const ids = DEFAULT_PRODUCT_CONFIGS.map((row) => row.revenueCatProductId)
  const unique = new Set(ids)
  assert.equal(ids.length, unique.size)
})

test('discount badges align with paywall design defaults', () => {
  const plusIos = {
    '1w': productFor('plus', 'ios', '1w'),
    '1m': productFor('plus', 'ios', '1m'),
    '3m': productFor('plus', 'ios', '3m'),
    '6m': productFor('plus', 'ios', '6m'),
  }
  assert.equal(plusIos['1w'].discountPercent, 0)
  assert.equal(plusIos['1m'].discountPercent, 50)
  assert.equal(plusIos['3m'].discountPercent, 65)
  assert.equal(plusIos['6m'].discountPercent, 75)
  assert.equal(plusIos['3m'].isDefault, true)
})

test('entitlement tiers stay tier-based independent of duration products', () => {
  assert.equal(DEFAULT_PLAN_CONFIGS.free.swipesPerDay, 15)
  assert.equal(DEFAULT_PLAN_CONFIGS.plus.swipesPerDay, null)
  assert.equal(DEFAULT_PLAN_CONFIGS.plus.canSeeLikes, true)
  assert.equal(DEFAULT_PLAN_CONFIGS.plus.readReceipts, false)
  assert.equal(DEFAULT_PLAN_CONFIGS.platin.readReceipts, true)
  assert.equal(DEFAULT_PLAN_CONFIGS.platin.weeklyBoost, true)
})
