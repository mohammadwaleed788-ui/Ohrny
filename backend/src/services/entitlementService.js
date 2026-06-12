import { and, asc, desc, eq, inArray, isNull, or, sql } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { users } from '../../db/schema/users.js'
import { matches } from '../../db/schema/matching.js'
import { messages } from '../../db/schema/messaging.js'
import {
  subscriptionPlans,
  subscriptionPlanProducts,
  userSubscriptions,
  inAppPurchases,
  userBoosts,
} from '../../db/schema/subscriptions.js'

export const PLAN_ORDER = ['free', 'plus', 'platin', 'private']
export const DURATION_ORDER = ['1w', '1m', '3m', '6m']

export const DEFAULT_PLAN_CONFIGS = {
  free: {
    id: 'free',
    name: 'Free',
    priceMonthly: null,
    currency: 'EUR',
    swipesPerDay: 15,
    maxChats: 4,
    maxMessagesPerChat: 10,
    superLikesPerWeek: 0,
    canSeeLikes: false,
    incognitoMode: false,
    priorityLikes: false,
    readReceipts: false,
    weeklyBoost: false,
    vaultFeature: false,
    concierge: false,
    travelMode: false,
    advancedCompatibility: false,
    globalMode: false,
    featuresJson: [],
    isActive: true,
    sortOrder: 0,
  },
  plus: {
    id: 'plus',
    name: 'Ohrny Plus',
    priceMonthly: null,
    currency: 'EUR',
    swipesPerDay: null,
    maxChats: null,
    maxMessagesPerChat: null,
    superLikesPerWeek: 5,
    canSeeLikes: true,
    incognitoMode: true,
    priorityLikes: false,
    readReceipts: false,
    weeklyBoost: false,
    vaultFeature: false,
    concierge: false,
    travelMode: true,
    advancedCompatibility: true,
    globalMode: true,
    featuresJson: [],
    isActive: true,
    sortOrder: 1,
  },
  platin: {
    id: 'platin',
    name: 'Ohrny Platin',
    priceMonthly: null,
    currency: 'EUR',
    swipesPerDay: null,
    maxChats: null,
    maxMessagesPerChat: null,
    superLikesPerWeek: 10,
    canSeeLikes: true,
    incognitoMode: true,
    priorityLikes: true,
    readReceipts: true,
    weeklyBoost: true,
    vaultFeature: false,
    concierge: false,
    travelMode: true,
    advancedCompatibility: true,
    globalMode: true,
    featuresJson: [],
    isActive: true,
    sortOrder: 2,
  },
  private: {
    id: 'private',
    name: 'Ohrny Private',
    priceMonthly: null,
    currency: 'EUR',
    swipesPerDay: null,
    maxChats: null,
    maxMessagesPerChat: null,
    superLikesPerWeek: 10,
    canSeeLikes: true,
    incognitoMode: true,
    priorityLikes: true,
    readReceipts: true,
    weeklyBoost: true,
    vaultFeature: true,
    concierge: true,
    travelMode: true,
    advancedCompatibility: true,
    globalMode: true,
    featuresJson: [],
    isActive: true,
    sortOrder: 3,
  },
}

function toMoneyString(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return '0.00'
  return n.toFixed(2)
}

function discountFromWeekly(baselineWeekly, weeklyPrice) {
  const baseline = Number(baselineWeekly)
  const weekly = Number(weeklyPrice)
  if (!Number.isFinite(baseline) || baseline <= 0 || !Number.isFinite(weekly) || weekly >= baseline) {
    return 0
  }
  return Math.max(0, Math.min(99, Math.round((1 - (weekly / baseline)) * 100)))
}

function buildPlanDurationProducts(planId, {
  weeklyByDuration,
  totalByDuration,
  currency = 'EUR',
  discountOverrides = {},
}) {
  const oneWeek = Number(weeklyByDuration['1w'])
  return ['ios', 'android'].flatMap((platform) => DURATION_ORDER.map((duration, index) => {
    const weekly = Number(weeklyByDuration[duration])
    const total = Number(totalByDuration[duration])
    const discountPercent = discountOverrides[duration] ?? discountFromWeekly(oneWeek, weekly)
    return {
      planId,
      platform,
      duration,
      revenueCatProductId: `ohrny_${planId}_${duration}_${platform}`,
      currency,
      totalPrice: toMoneyString(total),
      weeklyPrice: toMoneyString(weekly),
      compareAtWeeklyPrice: toMoneyString(oneWeek),
      discountPercent,
      isActive: true,
      isDefault: duration === '3m',
      sortOrder: index + 1,
      startsAt: null,
      endsAt: null,
    }
  }))
}

export const DEFAULT_PRODUCT_CONFIGS = [
  ...buildPlanDurationProducts('plus', {
    weeklyByDuration: { '1w': 4.99, '1m': 2.5, '3m': 1.75, '6m': 1.25 },
    totalByDuration: { '1w': 4.99, '1m': 9.98, '3m': 22.7, '6m': 32.44 },
    discountOverrides: { '1m': 50, '3m': 65, '6m': 75 },
  }),
  ...buildPlanDurationProducts('platin', {
    weeklyByDuration: { '1w': 12.99, '1m': 6.5, '3m': 4.55, '6m': 3.25 },
    totalByDuration: { '1w': 12.99, '1m': 25.98, '3m': 59.1, '6m': 84.44 },
    discountOverrides: { '1m': 50, '3m': 65, '6m': 75 },
  }),
]

const FEATURE_KEYS = [
  'canSeeLikes',
  'incognitoMode',
  'priorityLikes',
  'readReceipts',
  'weeklyBoost',
  'vaultFeature',
  'concierge',
  'travelMode',
  'advancedCompatibility',
  'globalMode',
  'verifiedOnly',
]

function planRank(planId) {
  const idx = PLAN_ORDER.indexOf(planId)
  return idx < 0 ? 0 : idx
}

function nowUtcDayStart(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

function nextUtcDayStart(date = new Date()) {
  const d = nowUtcDayStart(date)
  d.setUTCDate(d.getUTCDate() + 1)
  return d
}

function toNullableNumber(value) {
  if (value === null || value === undefined) return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function rowToPlanConfig(row, planId = 'free') {
  const fallback = DEFAULT_PLAN_CONFIGS[planId] || DEFAULT_PLAN_CONFIGS.free
  const src = row || fallback
  return {
    id: src.id || planId,
    name: src.name || fallback.name,
    priceMonthly: src.priceMonthly ?? fallback.priceMonthly,
    currency: src.currency || fallback.currency,
    swipesPerDay: src.swipesPerDay ?? fallback.swipesPerDay,
    maxChats: src.maxChats ?? fallback.maxChats,
    maxMessagesPerChat: src.maxMessagesPerChat ?? fallback.maxMessagesPerChat,
    superLikesPerWeek: Number(src.superLikesPerWeek ?? fallback.superLikesPerWeek ?? 0),
    canSeeLikes: Boolean(src.canSeeLikes ?? fallback.canSeeLikes),
    incognitoMode: Boolean(src.incognitoMode ?? fallback.incognitoMode),
    priorityLikes: Boolean(src.priorityLikes ?? fallback.priorityLikes),
    readReceipts: Boolean(src.readReceipts ?? fallback.readReceipts),
    weeklyBoost: Boolean(src.weeklyBoost ?? fallback.weeklyBoost),
    vaultFeature: Boolean(src.vaultFeature ?? fallback.vaultFeature),
    concierge: Boolean(src.concierge ?? fallback.concierge),
    travelMode: Boolean(src.travelMode ?? fallback.travelMode),
    advancedCompatibility: Boolean(src.advancedCompatibility ?? fallback.advancedCompatibility),
    globalMode: Boolean(src.globalMode ?? fallback.globalMode),
    featuresJson: src.featuresJson || fallback.featuresJson || [],
    isActive: src.isActive !== false,
    sortOrder: Number(src.sortOrder ?? fallback.sortOrder ?? 0),
  }
}

export async function seedSubscriptionPlans(client = db) {
  const now = new Date()
  for (const plan of Object.values(DEFAULT_PLAN_CONFIGS)) {
    await client
      .insert(subscriptionPlans)
      .values({
        ...plan,
        featuresJson: plan.featuresJson || [],
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: subscriptionPlans.id,
        set: {
          name: plan.name,
          priceMonthly: plan.priceMonthly,
          currency: plan.currency,
          swipesPerDay: plan.swipesPerDay,
          maxChats: plan.maxChats,
          maxMessagesPerChat: plan.maxMessagesPerChat,
          superLikesPerWeek: plan.superLikesPerWeek,
          canSeeLikes: plan.canSeeLikes,
          incognitoMode: plan.incognitoMode,
          priorityLikes: plan.priorityLikes,
          readReceipts: plan.readReceipts,
          weeklyBoost: plan.weeklyBoost,
          vaultFeature: plan.vaultFeature,
          concierge: plan.concierge,
          travelMode: plan.travelMode,
          advancedCompatibility: plan.advancedCompatibility,
          globalMode: plan.globalMode,
          featuresJson: plan.featuresJson || [],
          isActive: plan.isActive,
          sortOrder: plan.sortOrder,
          updatedAt: now,
        },
      })
  }
}

export async function seedSubscriptionProducts(client = db) {
  const now = new Date()
  for (const product of DEFAULT_PRODUCT_CONFIGS) {
    await client
      .insert(subscriptionPlanProducts)
      .values({
        ...product,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: subscriptionPlanProducts.revenueCatProductId,
        set: {
          planId: product.planId,
          platform: product.platform,
          duration: product.duration,
          currency: product.currency,
          totalPrice: product.totalPrice,
          weeklyPrice: product.weeklyPrice,
          compareAtWeeklyPrice: product.compareAtWeeklyPrice,
          discountPercent: product.discountPercent,
          isActive: product.isActive,
          isDefault: product.isDefault,
          sortOrder: product.sortOrder,
          startsAt: product.startsAt,
          endsAt: product.endsAt,
          updatedAt: now,
        },
      })
  }
}

export async function seedSubscriptionCatalog(client = db) {
  await seedSubscriptionPlans(client)
  await seedSubscriptionProducts(client)
}

export async function findSubscriptionProductByRevenueCatId(revenueCatProductId, client = db) {
  if (!revenueCatProductId) return null
  const [product] = await client
    .select()
    .from(subscriptionPlanProducts)
    .where(eq(subscriptionPlanProducts.revenueCatProductId, String(revenueCatProductId)))
    .limit(1)
  return product || null
}

export async function getActiveSubscriptionProductsGrouped(platform = null, client = db) {
  const now = new Date()
  const conditions = [
    eq(subscriptionPlanProducts.isActive, true),
    inArray(subscriptionPlanProducts.planId, ['plus', 'platin']),
    or(isNull(subscriptionPlanProducts.startsAt), sql`${subscriptionPlanProducts.startsAt} <= ${now}`),
    or(isNull(subscriptionPlanProducts.endsAt), sql`${subscriptionPlanProducts.endsAt} >= ${now}`),
  ]
  if (platform) conditions.push(eq(subscriptionPlanProducts.platform, platform))

  const rows = await client
    .select({
      id: subscriptionPlanProducts.id,
      planId: subscriptionPlanProducts.planId,
      platform: subscriptionPlanProducts.platform,
      duration: subscriptionPlanProducts.duration,
      revenueCatProductId: subscriptionPlanProducts.revenueCatProductId,
      currency: subscriptionPlanProducts.currency,
      totalPrice: subscriptionPlanProducts.totalPrice,
      weeklyPrice: subscriptionPlanProducts.weeklyPrice,
      compareAtWeeklyPrice: subscriptionPlanProducts.compareAtWeeklyPrice,
      discountPercent: subscriptionPlanProducts.discountPercent,
      isDefault: subscriptionPlanProducts.isDefault,
      sortOrder: subscriptionPlanProducts.sortOrder,
    })
    .from(subscriptionPlanProducts)
    .where(and(...conditions))
    .orderBy(
      asc(subscriptionPlanProducts.planId),
      asc(subscriptionPlanProducts.platform),
      asc(subscriptionPlanProducts.sortOrder),
    )

  const grouped = {}
  for (const row of rows) {
    if (!grouped[row.planId]) grouped[row.planId] = []
    grouped[row.planId].push({
      id: row.id,
      platform: row.platform,
      duration: row.duration,
      revenueCatProductId: row.revenueCatProductId,
      currency: row.currency,
      totalPrice: row.totalPrice,
      weeklyPrice: row.weeklyPrice,
      compareAtWeeklyPrice: row.compareAtWeeklyPrice,
      discountPercent: row.discountPercent,
      isDefault: row.isDefault,
      sortOrder: row.sortOrder,
    })
  }

  return grouped
}

async function loadPlan(planId, client = db) {
  const safePlanId = PLAN_ORDER.includes(planId) ? planId : 'free'
  const [plan] = await client
    .select()
    .from(subscriptionPlans)
    .where(and(eq(subscriptionPlans.id, safePlanId), eq(subscriptionPlans.isActive, true)))
    .limit(1)
  return rowToPlanConfig(plan, safePlanId)
}

async function resetDailySwipesIfNeeded(user, client = db) {
  const now = new Date()
  const nextReset = nextUtcDayStart(now)
  const resetAt = user.swipesResetAt ? new Date(user.swipesResetAt) : null
  if (resetAt && resetAt > now) return user

  await client
    .update(users)
    .set({ swipesUsedToday: 0, swipesResetAt: nextReset, updatedAt: now })
    .where(eq(users.id, user.id))

  return { ...user, swipesUsedToday: 0, swipesResetAt: nextReset }
}

async function loadActiveSubscription(userId, client = db) {
  const now = new Date()
  const rows = await client
    .select({
      id: userSubscriptions.id,
      planId: userSubscriptions.planId,
      duration: userSubscriptions.duration,
      status: userSubscriptions.status,
      startedAt: userSubscriptions.startedAt,
      expiresAt: userSubscriptions.expiresAt,
      gracePeriodEndsAt: userSubscriptions.gracePeriodEndsAt,
      priceAtPurchase: userSubscriptions.priceAtPurchase,
      currency: userSubscriptions.currency,
      plan: subscriptionPlans,
    })
    .from(userSubscriptions)
    .innerJoin(subscriptionPlans, eq(userSubscriptions.planId, subscriptionPlans.id))
    .where(
      and(
        eq(userSubscriptions.userId, userId),
        eq(subscriptionPlans.isActive, true),
        inArray(userSubscriptions.status, ['active', 'grace_period']),
        or(
          isNull(userSubscriptions.expiresAt),
          sql`${userSubscriptions.expiresAt} > ${now}`,
          sql`${userSubscriptions.gracePeriodEndsAt} > ${now}`,
        ),
      ),
    )
    .orderBy(desc(userSubscriptions.startedAt))

  rows.sort((a, b) => {
    const byPlan = planRank(b.planId) - planRank(a.planId)
    if (byPlan !== 0) return byPlan
    return new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
  })

  return rows[0] || null
}

// The user's currently running boost window, or null. A boost is active when
// is_active = true AND it hasn't expired yet (the 5-min cleanup cron can lag).
export async function getActiveBoost(userId, client = db) {
  const [activeBoost] = await client
    .select({
      id: userBoosts.id,
      startedAt: userBoosts.startedAt,
      expiresAt: userBoosts.expiresAt,
    })
    .from(userBoosts)
    .where(
      and(
        eq(userBoosts.userId, userId),
        eq(userBoosts.isActive, true),
        sql`${userBoosts.expiresAt} > ${new Date()}`,
      ),
    )
    .orderBy(desc(userBoosts.expiresAt))
    .limit(1)

  return activeBoost || null
}

export async function getStartedChatCount(userId, client = db) {
  const rows = await client
    .selectDistinct({ matchId: messages.matchId })
    .from(messages)
    .where(and(eq(messages.senderId, userId), isNull(messages.deletedAt)))

  return rows.length
}

export async function getVisibleSentMessageCount(matchId, userId, client = db) {
  const [row] = await client
    .select({ count: sql`count(*)::int` })
    .from(messages)
    .where(
      and(
        eq(messages.matchId, matchId),
        eq(messages.senderId, userId),
        isNull(messages.deletedAt),
      ),
    )

  return Number(row?.count || 0)
}

export async function getEffectiveEntitlements(userId, client = db) {
  const [rawUser] = await client
    .select({
      id: users.id,
      plan: users.plan,
      swipesUsedToday: users.swipesUsedToday,
      swipesResetAt: users.swipesResetAt,
      superLikesLeft: users.superLikesLeft,
      boostsLeft: users.boostsLeft,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  if (!rawUser) return null

  const user = await resetDailySwipesIfNeeded(rawUser, client)
  const activeSubscription = await loadActiveSubscription(userId, client)
  // The active subscription row is the source of truth. Do NOT fall back to the
  // cached users.plan column — a sub that expired by time (with no EXPIRATION
  // webhook) would otherwise keep the user on a paid tier forever.
  const planId = activeSubscription?.planId || 'free'
  // Self-heal the cached column so it matches reality (only on the real db
  // connection, never inside a caller's transaction).
  if (user.plan !== planId && client === db) {
    await client
      .update(users)
      .set({ plan: planId, updatedAt: new Date() })
      .where(eq(users.id, userId))
  }
  const plan = activeSubscription?.plan
    ? rowToPlanConfig(activeSubscription.plan, planId)
    : await loadPlan(planId, client)
  const startedChats = await getStartedChatCount(userId, client)
  const activeBoost = await getActiveBoost(userId, client)

  const features = {}
  for (const key of FEATURE_KEYS) features[key] = Boolean(plan[key])
  features.verifiedOnly = planRank(plan.id) >= planRank('plus')

  return {
    plan: plan.id,
    planName: plan.name,
    activeSubscription: activeSubscription
      ? {
          id: activeSubscription.id,
          planId: activeSubscription.planId,
          duration: activeSubscription.duration,
          status: activeSubscription.status,
          startedAt: activeSubscription.startedAt,
          expiresAt: activeSubscription.expiresAt,
          gracePeriodEndsAt: activeSubscription.gracePeriodEndsAt,
        }
      : null,
    limits: {
      swipesPerDay: toNullableNumber(plan.swipesPerDay),
      maxChats: toNullableNumber(plan.maxChats),
      maxMessagesPerChat: toNullableNumber(plan.maxMessagesPerChat),
      superLikesPerWeek: Number(plan.superLikesPerWeek || 0),
    },
    usage: {
      swipesUsedToday: Number(user.swipesUsedToday || 0),
      startedChats,
      swipesResetAt: user.swipesResetAt,
    },
    balances: {
      superLikesLeft: Number(user.superLikesLeft || 0),
      boostsLeft: Number(user.boostsLeft || 0),
    },
    activeBoost,
    features,
  }
}

export async function assertFeature(userId, featureKey, client = db) {
  const entitlements = await getEffectiveEntitlements(userId, client)
  if (!entitlements) {
    return { ok: false, status: 404, body: { error: 'user_not_found' } }
  }
  if (!entitlements.features[featureKey]) {
    return {
      ok: false,
      status: 403,
      body: { error: 'feature_locked', feature: featureKey, paywall: targetPlanForFeature(featureKey) },
      entitlements,
    }
  }
  return { ok: true, entitlements }
}

export function targetPlanForFeature(featureKey) {
  if (['priorityLikes', 'readReceipts', 'weeklyBoost'].includes(featureKey)) return 'platin'
  if (['vaultFeature', 'concierge'].includes(featureKey)) return 'private'
  return 'plus'
}

export async function assertCanSwipe(userId, type, client = db) {
  const entitlements = await getEffectiveEntitlements(userId, client)
  if (!entitlements) {
    return { ok: false, status: 404, body: { error: 'user_not_found' } }
  }

  const cap = entitlements.limits.swipesPerDay
  if (cap !== null && entitlements.usage.swipesUsedToday >= cap) {
    return {
      ok: false,
      status: 403,
      body: { error: 'swipe_limit', paywall: 'swipes' },
      entitlements,
    }
  }

  if (type === 'super_like' && entitlements.balances.superLikesLeft <= 0) {
    return {
      ok: false,
      status: 403,
      body: { error: 'insufficient_balance', type: 'super_likes' },
      entitlements,
    }
  }

  return { ok: true, entitlements }
}

export async function consumeSwipe(userId, type, client = db, options = {}) {
  const countSwipe = options.countSwipe !== false
  const updates = {
    updatedAt: new Date(),
  }
  if (countSwipe) {
    updates.swipesUsedToday = sql`${users.swipesUsedToday} + 1`
  }
  if (type === 'super_like') {
    updates.superLikesLeft = sql`greatest(${users.superLikesLeft} - 1, 0)`
  }
  await client.update(users).set(updates).where(eq(users.id, userId))
}

export async function assertCanMessage(userId, matchId, client = db) {
  const entitlements = await getEffectiveEntitlements(userId, client)
  if (!entitlements) {
    return { ok: false, status: 404, body: { error: 'user_not_found' } }
  }

  const myMessageCount = await getVisibleSentMessageCount(matchId, userId, client)
  const maxMessages = entitlements.limits.maxMessagesPerChat
  if (maxMessages !== null && myMessageCount >= maxMessages) {
    return {
      ok: false,
      status: 403,
      body: { error: 'message_limit', paywall: 'messages' },
      entitlements,
      myMessageCount,
    }
  }

  const maxChats = entitlements.limits.maxChats
  if (maxChats !== null && myMessageCount === 0 && entitlements.usage.startedChats >= maxChats) {
    return {
      ok: false,
      status: 403,
      body: { error: 'chat_limit', paywall: 'matches' },
      entitlements,
      myMessageCount,
    }
  }

  return { ok: true, entitlements, myMessageCount }
}

export async function activateBoost(userId, client = db) {
  return client.transaction(async (tx) => {
    const entitlements = await getEffectiveEntitlements(userId, tx)
    if (!entitlements) {
      return { ok: false, status: 404, body: { error: 'user_not_found' } }
    }
    if (entitlements.balances.boostsLeft <= 0) {
      return {
        ok: false,
        status: 403,
        body: { error: 'insufficient_balance', type: 'boosts' },
      }
    }

    const now = new Date()
    if (entitlements.activeBoost) {
      return {
        ok: false,
        status: 409,
        body: {
          error: 'boost_already_active',
          activeBoost: entitlements.activeBoost,
        },
      }
    }

    const expiresAt = new Date(now.getTime() + 30 * 60 * 1000)
    await tx
      .update(users)
      .set({ boostsLeft: sql`greatest(${users.boostsLeft} - 1, 0)`, updatedAt: now })
      .where(eq(users.id, userId))

    const [boost] = await tx
      .insert(userBoosts)
      .values({ userId, startedAt: now, expiresAt, isActive: true, isFreeWeekly: false })
      .returning()

    return { ok: true, boost }
  })
}

export async function deactivateExpiredBoosts(client = db) {
  const now = new Date()
  const updated = await client
    .update(userBoosts)
    .set({ isActive: false })
    .where(
      and(
        eq(userBoosts.isActive, true),
        sql`${userBoosts.expiresAt} <= ${now}`,
      ),
    )
    .returning({ id: userBoosts.id })

  return updated.length
}

export async function grantPurchase({
  userId,
  type,
  quantity,
  priceAtPurchase,
  currency = 'EUR',
  revenueCatProductId = null,
  revenueCatTransactionId = null,
  platform = 'ios',
  purchasedAt = new Date(),
}, client = db) {
  if (!['super_likes', 'boosts'].includes(type)) {
    return { ok: false, status: 400, body: { error: 'invalid_purchase_type' } }
  }
  const safeQty = Math.max(1, Math.min(1000, Math.round(Number(quantity) || 0)))

  return client.transaction(async (tx) => {
    if (revenueCatTransactionId) {
      const [existing] = await tx
        .select({ id: inAppPurchases.id })
        .from(inAppPurchases)
        .where(eq(inAppPurchases.revenueCatTransactionId, revenueCatTransactionId))
        .limit(1)
      if (existing) return { ok: true, duplicate: true }
    }

    await tx.insert(inAppPurchases).values({
      userId,
      type,
      quantity: safeQty,
      priceAtPurchase: String(priceAtPurchase ?? '0'),
      currency,
      revenueCatProductId,
      revenueCatTransactionId,
      platform,
      purchasedAt,
    })

    const field = type === 'super_likes' ? 'superLikesLeft' : 'boostsLeft'
    await tx
      .update(users)
      .set({ [field]: sql`${users[field]} + ${safeQty}`, updatedAt: new Date() })
      .where(eq(users.id, userId))

    return { ok: true, duplicate: false, quantity: safeQty }
  })
}

export async function syncUserPlanCache(userId, client = db) {
  const activeSubscription = await loadActiveSubscription(userId, client)
  const plan = activeSubscription?.planId || 'free'
  await client.update(users).set({ plan, updatedAt: new Date() }).where(eq(users.id, userId))
  return plan
}

export async function grantWeeklyPlatinBoosts(client = db) {
  const rows = await client
    .select({ userId: users.id })
    .from(users)
    .where(inArray(users.plan, ['platin', 'private']))

  const now = new Date()
  for (const row of rows) {
    const [recent] = await client
      .select({ id: userBoosts.id })
      .from(userBoosts)
      .where(
        and(
          eq(userBoosts.userId, row.userId),
          eq(userBoosts.isFreeWeekly, true),
          sql`${userBoosts.createdAt} >= ${new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)}`,
        ),
      )
      .limit(1)
    if (recent) continue

    await client
      .update(users)
      .set({ boostsLeft: sql`${users.boostsLeft} + 1`, updatedAt: now })
      .where(eq(users.id, row.userId))
    await client.insert(userBoosts).values({
      userId: row.userId,
      startedAt: now,
      expiresAt: now,
      isActive: false,
      isFreeWeekly: true,
    })
  }
}
