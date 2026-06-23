import { and, asc, desc, eq, inArray, isNull, lt, or, sql } from 'drizzle-orm'
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
import { userDiscoverPreferences } from '../../db/schema/settings.js'
import { REVENUECAT_SECRET_KEY } from '../config/constants.js'
import {
  notifyWeeklySuperLikes,
  notifyWeeklyBoost,
} from './notifications/subscriptionNotification.js'

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
    // 7/week — same weekly top-up mechanism as Plus, marketed as "~1 a day".
    superLikesPerWeek: 7,
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
      iam: users.iam,
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
  // Women message without any cap (per-chat or chat-count), regardless of plan.
  const unlimitedMessaging = user.iam === 'woman'
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

  // Self-heal preferences if subscription is expired/free
  if (planId === 'free' && client === db) {
    await client
      .update(userDiscoverPreferences)
      .set({
        verifiedOnly: false,
        advancedCompatibility: false,
        travelMode: false,
        globalMode: false,
        heightMin: 140,
        heightMax: 220,
        heightUnit: 'cm',
        diet: [],
        drinks: [],
        smokes: [],
        exercise: [],
        kids: [],
        pets: [],
        education: [],
        religion: [],
        zodiac: [],
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(userDiscoverPreferences.userId, userId),
          or(
            eq(userDiscoverPreferences.verifiedOnly, true),
            eq(userDiscoverPreferences.advancedCompatibility, true),
            eq(userDiscoverPreferences.travelMode, true),
            eq(userDiscoverPreferences.globalMode, true),
            sql`${userDiscoverPreferences.heightMin} <> 140`,
            sql`${userDiscoverPreferences.heightMax} <> 220`,
            sql`${userDiscoverPreferences.diet} <> '{}'::text[]`,
            sql`${userDiscoverPreferences.drinks} <> '{}'::text[]`,
            sql`${userDiscoverPreferences.smokes} <> '{}'::text[]`,
            sql`${userDiscoverPreferences.exercise} <> '{}'::text[]`,
            sql`${userDiscoverPreferences.kids} <> '{}'::text[]`,
            sql`${userDiscoverPreferences.pets} <> '{}'::text[]`,
            sql`${userDiscoverPreferences.education} <> '{}'::text[]`,
            sql`${userDiscoverPreferences.religion} <> '{}'::text[]`,
            sql`${userDiscoverPreferences.zodiac} <> '{}'::text[]`
          )
        )
      )
  }
  const plan = activeSubscription?.plan
    ? rowToPlanConfig(activeSubscription.plan, planId)
    : await loadPlan(planId, client)
  const startedChats = await getStartedChatCount(userId, client)
  const activeBoost = await getActiveBoost(userId, client)

  const features = {}
  for (const key of FEATURE_KEYS) features[key] = Boolean(plan[key])
  features.verifiedOnly = planRank(plan.id) >= planRank('plus')
  // Rewind last swipe — any paid plan (Plus and above).
  features.rewindLastSwipe = planRank(plan.id) >= planRank('plus')
  // Privacy keepers — hide age / hide distance (Plus and above).
  features.hideAge = planRank(plan.id) >= planRank('plus')
  features.hideDistance = planRank(plan.id) >= planRank('plus')

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
      // Women always message without limit (no per-chat or chat-count cap),
      // regardless of plan. Everyone else follows their plan's caps.
      maxChats: unlimitedMessaging ? null : toNullableNumber(plan.maxChats),
      maxMessagesPerChat: unlimitedMessaging
        ? null
        : toNullableNumber(plan.maxMessagesPerChat),
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
    // A boost already running takes precedence over balance: you can't run two,
    // and the client should sync its timer (409) rather than be told to buy.
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
    if (entitlements.balances.boostsLeft <= 0) {
      return {
        ok: false,
        status: 403,
        body: { error: 'insufficient_balance', type: 'boosts' },
      }
    }

    const now = new Date()
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

// Cancel the running boost early. The boost is CONSUMED (no refund) — otherwise
// a user could cancel near the end and re-use the same boost indefinitely.
// Returns the current balance (unchanged) for the client to sync.
export async function cancelBoost(userId, client = db) {
  return client.transaction(async (tx) => {
    const active = await getActiveBoost(userId, tx)
    if (!active) {
      return { ok: false, status: 409, body: { error: 'no_active_boost' } }
    }

    const now = new Date()
    await tx
      .update(userBoosts)
      .set({ isActive: false, expiresAt: now })
      .where(eq(userBoosts.id, active.id))

    const [row] = await tx
      .select({ boostsLeft: users.boostsLeft })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)

    return { ok: true, boostsLeft: Number(row?.boostsLeft || 0) }
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

// Maps a store product id → consumable grant. Ordered LARGEST-first because
// `super.*5` also matches "15"/"30". Shared by the RevenueCat webhook AND the
// client-confirm endpoint so both credit identically.
const CONSUMABLE_PACKS = [
  { match: /super.*30|30.*super/i, type: 'super_likes', quantity: 30 },
  { match: /super.*15|15.*super/i, type: 'super_likes', quantity: 15 },
  { match: /super.*5|5.*super/i, type: 'super_likes', quantity: 5 },
  { match: /boost.*10|10.*boost/i, type: 'boosts', quantity: 10 },
  { match: /boost.*5|5.*boost/i, type: 'boosts', quantity: 5 },
  { match: /boost.*1|1.*boost/i, type: 'boosts', quantity: 1 },
]

export function normalizeConsumableProduct(productId) {
  const raw = String(productId || '')
  return CONSUMABLE_PACKS.find((pack) => pack.match.test(raw)) || null
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

function storeToPlatform(store) {
  const raw = String(store || '').toLowerCase()
  if (raw.includes('play') || raw.includes('android')) return 'android'
  if (raw.includes('app_store') || raw.includes('ios')) return 'ios'
  if (raw.includes('stripe') || raw.includes('web')) return 'web'
  return 'ios'
}

// Fetch a user's RevenueCat subscriber object from the V1 REST API. The single
// source of truth for both subscription and one-time purchase verification, so
// the client can never fake a plan or a Super-Like/Boost grant. Returns the
// `subscriber` object, or null if not configured / unreachable / not found.
async function fetchRevenueCatSubscriber(appUserId) {
  if (!REVENUECAT_SECRET_KEY || !appUserId) return null
  try {
    const resp = await fetch(
      `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(appUserId)}`,
      { headers: { Authorization: `Bearer ${REVENUECAT_SECRET_KEY}` } },
    )
    if (!resp.ok) {
      console.error(`RevenueCat REST ${resp.status} for ${appUserId}`)
      return null
    }
    const json = await resp.json()
    return json?.subscriber || null
  } catch (err) {
    console.error('RevenueCat REST fetch failed:', err)
    return null
  }
}

// The RevenueCat app_user_id for a DB user: their stored revenueCatUserId, or
// users.id (what the app logs in as). Persists the mapping when missing so the
// webhook can later find the user by app_user_id too.
async function resolveAppUserId(userId) {
  const [u] = await db
    .select({ id: users.id, revenueCatUserId: users.revenueCatUserId })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)
  if (!u) return null
  return { appUserId: u.revenueCatUserId || u.id, hadMapping: Boolean(u.revenueCatUserId) }
}

// Confirm a one-time purchase (Super Likes / Boosts) actually exists in
// RevenueCat before crediting it. Returns true only when RevenueCat's
// `non_subscriptions` lists this product with a matching store transaction id.
// When the secret key isn't configured we return null = "can't verify" so the
// caller can decide its fallback (the webhook is still authoritative).
export async function verifyConsumableWithRevenueCat(userId, productId, transactionId) {
  if (!REVENUECAT_SECRET_KEY) return null
  const resolved = await resolveAppUserId(userId)
  if (!resolved) return false
  const subscriber = await fetchRevenueCatSubscriber(resolved.appUserId)
  if (!subscriber) return false

  const purchases = (subscriber.non_subscriptions || {})[String(productId)] || []
  if (!Array.isArray(purchases) || purchases.length === 0) return false
  // Match the exact transaction the client claims (prevents replaying a fake id
  // for a product they never bought). RevenueCat exposes both its own id and the
  // store's transaction id — accept either.
  const txn = String(transactionId || '')
  if (!txn) return false
  return purchases.some(
    (p) => String(p.store_transaction_id || '') === txn || String(p.id || '') === txn,
  )
}

// Verify a user's subscription DIRECTLY with RevenueCat's REST API and apply it
// to the DB immediately — the synchronous counterpart to the async webhook. The
// app calls this right after a subscription purchase so premium unlocks at once
// instead of waiting for (or being blocked by a missed) webhook. RevenueCat is
// the source of truth here: we only grant what its `subscribers` endpoint says
// is currently active, so the client can't fake a plan. Idempotent — the webhook
// later reconciles the authoritative transaction row over the one we write.
export async function syncSubscriptionFromRevenueCat(userId) {
  if (!REVENUECAT_SECRET_KEY) return { ok: false, reason: 'not_configured' }

  // We identify RevenueCat as users.id and persist it as revenueCatUserId on the
  // first webhook — either is a valid REST lookup key for the same subscriber.
  const resolved = await resolveAppUserId(userId)
  if (!resolved) return { ok: false, reason: 'user_not_found' }
  const { appUserId, hadMapping } = resolved

  const subscriber = await fetchRevenueCatSubscriber(appUserId)
  if (!subscriber) return { ok: false, reason: 'revenuecat_unavailable' }

  // Persist the mapping so the webhook can find this user by app_user_id later.
  if (!hadMapping && appUserId) {
    await db
      .update(users)
      .set({ revenueCatUserId: appUserId, updatedAt: new Date() })
      .where(eq(users.id, userId))
  }

  await seedSubscriptionCatalog()

  const nowMs = Date.now()
  const entitlements = subscriber.entitlements || {}
  const active = Object.entries(entitlements)
    .map(([id, info]) => ({
      id,
      info,
      exp: info?.expires_date ? Date.parse(info.expires_date) : null,
    }))
    .filter((e) => PLAN_ORDER.includes(e.id) && e.id !== 'free' && (e.exp === null || e.exp > nowMs))
    .sort((a, b) => planRank(b.id) - planRank(a.id))[0]

  // No active paid entitlement on RevenueCat → just reconcile the cached plan
  // (expires anything stale to free); never grant.
  if (!active) {
    const plan = await syncUserPlanCache(userId)
    return { ok: true, plan, granted: false }
  }

  const entitlementId = active.id
  const productId = active.info.product_identifier || null
  const detail = (subscriber.subscriptions || {})[productId] || {}
  const product = await findSubscriptionProductByRevenueCatId(productId)
  const planId = product?.planId || entitlementId
  const now = new Date()
  const startedAt = detail.purchase_date ? new Date(detail.purchase_date) : now
  const expiresAt = active.exp ? new Date(active.exp) : null
  const platform = storeToPlatform(detail.store)

  await db.transaction(async (tx) => {
    // Supersede any currently-active row (a plan change / re-sync).
    await tx
      .update(userSubscriptions)
      .set({ status: 'expired', updatedAt: now })
      .where(and(eq(userSubscriptions.userId, userId), eq(userSubscriptions.status, 'active')))

    // Reuse the row for this product if we've seen it (avoids row bloat on
    // repeated syncs); otherwise create one. The webhook later upserts by its
    // real transaction id and supersedes this either way.
    const [existing] = await tx
      .select({ id: userSubscriptions.id })
      .from(userSubscriptions)
      .where(
        and(
          eq(userSubscriptions.userId, userId),
          eq(userSubscriptions.revenueCatProductId, String(productId || '')),
        ),
      )
      .orderBy(desc(userSubscriptions.startedAt))
      .limit(1)

    const row = {
      userId,
      planId,
      productId: product?.id || null,
      revenueCatProductId: productId,
      duration: product?.duration || null,
      revenueCatEntitlementId: entitlementId,
      status: 'active',
      platform,
      priceAtPurchase: String(product?.totalPrice || '0'),
      currency: product?.currency || 'EUR',
      startedAt,
      expiresAt,
      cancelledAt: null,
      gracePeriodEndsAt: null,
      updatedAt: now,
    }

    if (existing) {
      await tx.update(userSubscriptions).set(row).where(eq(userSubscriptions.id, existing.id))
    } else {
      await tx.insert(userSubscriptions).values(row)
    }

    await syncUserPlanCache(userId, tx)
    await topUpSuperLikesForPlan(userId, tx)
  })

  return { ok: true, plan: planId, granted: true }
}

// Weekly Super Like allowance per plan (Plus = 5, Platin/Private = 10). Tops up
// each paid user TO their allowance — never reduces, so purchased Super Likes
// are preserved and re-running is harmless (GREATEST is idempotent).
export async function grantWeeklySuperLikes(client = db) {
  const now = new Date()
  for (const [planId, cfg] of Object.entries(DEFAULT_PLAN_CONFIGS)) {
    const allowance = Number(cfg.superLikesPerWeek || 0)
    if (allowance <= 0) continue
    // Only members below the allowance are actually topped up — notify just
    // them (those already at/above the cap get no change and no notification).
    const toGrant = await client
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.plan, planId), lt(users.superLikesLeft, allowance)))
    await client
      .update(users)
      .set({
        superLikesLeft: sql`greatest(${users.superLikesLeft}, ${allowance})`,
        updatedAt: now,
      })
      .where(eq(users.plan, planId))
    for (const u of toGrant) notifyWeeklySuperLikes(u.id, allowance)
  }
}

// Top up one user's Super Likes to their plan allowance (used on subscribe so a
// new subscriber gets their weekly Super Likes immediately, not next Monday).
export async function topUpSuperLikesForPlan(userId, client = db) {
  const [u] = await client
    .select({ plan: users.plan })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)
  if (!u) return
  const allowance = Number(DEFAULT_PLAN_CONFIGS[u.plan]?.superLikesPerWeek || 0)
  if (allowance <= 0) return
  await client
    .update(users)
    .set({
      superLikesLeft: sql`greatest(${users.superLikesLeft}, ${allowance})`,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId))
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
    notifyWeeklyBoost(row.userId)
  }
}
