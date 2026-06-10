import { and, eq, inArray, isNull, or, sql } from 'drizzle-orm'
import { db } from '../../../db/index.js'
import { users } from '../../../db/schema/users.js'
import { userSubscriptions } from '../../../db/schema/subscriptions.js'
import {
  getEffectiveEntitlements,
  grantPurchase,
  syncUserPlanCache,
} from '../../services/entitlementService.js'

const ALLOWED_PLAN_IDS = new Set(['plus', 'platin'])
const ALLOWED_DURATIONS = new Set(['1w', '1m', '3m', '6m'])
const ALLOWED_PLATFORMS = new Set(['ios', 'android', 'web'])
const ALLOWED_PURCHASE_TYPES = new Set(['super_likes', 'boosts'])
const DEFAULT_EXPIRY_PRESET = '365d'
const EXPIRY_PRESET_MS = {
  '20m': 20 * 60 * 1000,
  '1d': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
  '365d': 365 * 24 * 60 * 60 * 1000,
}

function normalizeLower(value) {
  return String(value || '').trim().toLowerCase()
}

function resolveExpiryDate(preset, now = new Date()) {
  const safePreset = String(preset || DEFAULT_EXPIRY_PRESET).trim().toLowerCase()
  if (safePreset === 'perpetual') return null
  const ms = EXPIRY_PRESET_MS[safePreset] ?? EXPIRY_PRESET_MS[DEFAULT_EXPIRY_PRESET]
  return new Date(now.getTime() + ms)
}

function entitlementsSnapshot(entitlements) {
  return {
    effectivePlan: entitlements?.plan || 'free',
    activeSubscription: entitlements?.activeSubscription || null,
    balances: {
      superLikesLeft: Number(entitlements?.balances?.superLikesLeft || 0),
      boostsLeft: Number(entitlements?.balances?.boostsLeft || 0),
    },
  }
}

async function ensureActiveUser(userId) {
  const [row] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.id, userId), isNull(users.deletedAt)))
    .limit(1)
  return row || null
}

export async function getUsers(req, res) {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1)
    const limit = Math.min(50, Math.max(10, parseInt(req.query.limit) || 20))
    const offset = (page - 1) * limit
    const q = (req.query.q || '').trim()
    const status = req.query.status || 'all'
    const sortBy = req.query.sort || 'last_active'

    const conditions = [`u.deleted_at IS NULL`]

    if (q) {
      conditions.push(`(
        u.handle ILIKE ${`'%${q.replace(/'/g, "''")}%'`}
        OR u.city ILIKE ${`'%${q.replace(/'/g, "''")}%'`}
        OR u.id::text ILIKE ${`'%${q.replace(/'/g, "''")}%'`}
      )`)
    }

    if (status === 'active') conditions.push(`u.is_banned = false AND u.is_paused = false`)
    else if (status === 'verified') conditions.push(`u.id_verified = true AND u.is_banned = false`)
    else if (status === 'shadow') conditions.push(`u.is_banned = false AND u.is_paused = false`)
    else if (status === 'paused') conditions.push(`u.is_paused = true`)
    else if (status === 'banned') conditions.push(`u.is_banned = true`)

    const whereClause = conditions.join(' AND ')

    const orderMap = {
      last_active: 'u.updated_at DESC',
      newest: 'u.created_at DESC',
      oldest: 'u.created_at ASC',
      most_matches: 'match_count DESC NULLS LAST',
      most_reports: 'report_count DESC NULLS LAST',
    }
    const orderBy = orderMap[sortBy] || orderMap.last_active

    const countResult = await db.execute(sql.raw(`
      SELECT COUNT(*)::int as total
      FROM users u
      WHERE ${whereClause}
    `))
    const total = (countResult.rows || countResult)[0]?.total || 0

    const usersResult = await db.execute(sql.raw(`
      SELECT
        u.id,
        u.handle,
        u.age,
        u.iam,
        u.city,
        u.country_code,
        u.plan,
        u.is_banned,
        u.is_paused,
        u.id_verified,
        u.updated_at,
        u.created_at,
        COALESCE(m.match_count, 0)::int as match_count,
        COALESCE(msg.msg_count, 0)::int as msg_count,
        COALESCE(r.report_count, 0)::int as report_count
      FROM users u
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int as match_count
        FROM matches
        WHERE user_a_id = u.id OR user_b_id = u.id
      ) m ON true
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int as msg_count
        FROM messages
        WHERE sender_id = u.id AND deleted_at IS NULL
      ) msg ON true
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int as report_count
        FROM reports
        WHERE reported_id = u.id
      ) r ON true
      WHERE ${whereClause}
      ORDER BY ${orderBy}
      LIMIT ${limit} OFFSET ${offset}
    `))

    const rows = (usersResult.rows || usersResult).map(u => {
      let status = 'active'
      if (u.is_banned) status = 'banned'
      else if (u.is_paused) status = 'paused'
      else if (u.id_verified) status = 'verified'

      return {
        id: u.id,
        handle: `@${u.handle}`,
        age: u.age,
        gender: u.iam === 'man' ? 'M' : u.iam === 'woman' ? 'F' : 'NB',
        city: u.city || '—',
        country: u.country_code || '',
        plan: u.plan,
        status,
        matches: u.match_count,
        msgs: u.msg_count,
        reports: u.report_count,
        lastActive: formatRelative(u.updated_at),
        joined: formatDate(u.created_at),
      }
    })

    // Summary stats
    const statsResult = await db.execute(sql`
      SELECT
        COUNT(CASE WHEN deleted_at IS NULL THEN 1 END)::int as total_users,
        COUNT(CASE WHEN deleted_at IS NULL AND updated_at >= NOW() - INTERVAL '1 day' THEN 1 END)::int as active_today
      FROM users
    `)
    const stats = (statsResult.rows || statsResult)[0] || {}

    return res.json({
      users: rows,
      pagination: {
        page,
        limit,
        total: Number(total),
        pages: Math.ceil(Number(total) / limit),
      },
      stats: {
        total: Number(stats.total_users || 0),
        activeToday: Number(stats.active_today || 0),
      },
    })
  } catch (err) {
    console.error('Users API error:', err)
    return res.status(500).json({ error: 'Failed to load users' })
  }
}

export async function getUserDetail(req, res) {
  try {
    const { userId } = req.params

    const userResult = await db.execute(sql`
      SELECT
        u.id, u.handle, u.age, u.iam, u.pronouns,
        u.bio, u.about_me, u.looking, u.relationship_goal, u.rel_status,
        u.work, u.orientation,
        u.city, u.country_code,
        u.plan, u.is_banned, u.is_paused, u.id_verified, u.phone_verified,
        u.created_at, u.updated_at
      FROM users u
      WHERE u.id = ${userId} AND u.deleted_at IS NULL
    `)
    const user = (userResult.rows || userResult)[0]
    if (!user) return res.status(404).json({ error: 'User not found' })

    // Match/message stats
    const [matchStats] = (await db.execute(sql`
      SELECT COUNT(*)::int as total_matches
      FROM matches WHERE (user_a_id = ${userId} OR user_b_id = ${userId})
    `)).rows || await db.execute(sql`
      SELECT COUNT(*)::int as total_matches
      FROM matches WHERE (user_a_id = ${userId} OR user_b_id = ${userId})
    `)
    const [msgStats] = (await db.execute(sql`
      SELECT COUNT(*)::int as total_msgs
      FROM messages WHERE sender_id = ${userId} AND deleted_at IS NULL
    `)).rows || await db.execute(sql`
      SELECT COUNT(*)::int as total_msgs
      FROM messages WHERE sender_id = ${userId} AND deleted_at IS NULL
    `)

    // Reports against this user
    const reportsResult = await db.execute(sql`
      SELECT id, reason, details, status, created_at
      FROM reports
      WHERE reported_id = ${userId}
      ORDER BY created_at DESC
      LIMIT 10
    `)

    // Device info
    const deviceResult = await db.execute(sql`
      SELECT device_model, device_platform
      FROM user_devices
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
      LIMIT 1
    `)
    const device = (deviceResult.rows || deviceResult)[0]

    let status = 'active'
    if (user.is_banned) status = 'banned'
    else if (user.is_paused) status = 'paused'
    else if (user.id_verified) status = 'verified'

    return res.json({
      id: user.id,
      handle: `@${user.handle}`,
      age: user.age,
      gender: user.iam === 'man' ? 'M' : user.iam === 'woman' ? 'F' : 'NB',
      pronouns: user.pronouns,
      bio: user.bio || user.about_me || '',
      looking: user.looking,
      relationshipGoal: user.relationship_goal,
      relStatus: user.rel_status,
      work: user.work,
      orientation: user.orientation,
      city: user.city || '—',
      country: user.country_code || '',
      plan: user.plan,
      status,
      phoneVerified: user.phone_verified,
      idVerified: user.id_verified,
      joined: formatDate(user.created_at),
      lastActive: formatRelative(user.updated_at),
      matches: Number(matchStats?.total_matches || 0),
      msgs: Number(msgStats?.total_msgs || 0),
      reports: (reportsResult.rows || reportsResult).map(r => ({
        id: r.id,
        reason: r.reason,
        details: r.details,
        status: r.status,
        date: formatRelative(r.created_at),
      })),
      device: device ? `${device.device_model || 'Unknown'} · ${device.device_platform || ''}` : null,
    })
  } catch (err) {
    console.error('User detail API error:', err)
    return res.status(500).json({ error: 'Failed to load user detail' })
  }
}

export async function getUserSubscription(req, res) {
  try {
    const { userId } = req.params
    const user = await ensureActiveUser(userId)
    if (!user) return res.status(404).json({ error: 'User not found' })

    const entitlements = await getEffectiveEntitlements(userId)
    return res.json(entitlementsSnapshot(entitlements))
  } catch (err) {
    console.error('Admin getUserSubscription error:', err)
    return res.status(500).json({ error: 'Failed to load subscription snapshot' })
  }
}

export async function grantUserSubscription(req, res) {
  try {
    const { userId } = req.params
    const user = await ensureActiveUser(userId)
    if (!user) return res.status(404).json({ error: 'User not found' })

    const planId = normalizeLower(req.body?.planId)
    const duration = normalizeLower(req.body?.duration)
    const platform = normalizeLower(req.body?.platform || 'ios')
    const expiryPreset = normalizeLower(req.body?.expiryPreset || DEFAULT_EXPIRY_PRESET)

    if (!ALLOWED_PLAN_IDS.has(planId)) return res.status(400).json({ error: 'Invalid planId' })
    if (!ALLOWED_DURATIONS.has(duration)) return res.status(400).json({ error: 'Invalid duration' })
    if (!ALLOWED_PLATFORMS.has(platform)) return res.status(400).json({ error: 'Invalid platform' })
    if (expiryPreset !== 'perpetual' && !EXPIRY_PRESET_MS[expiryPreset]) {
      return res.status(400).json({ error: 'Invalid expiryPreset' })
    }

    const now = new Date()
    const expiresAt = resolveExpiryDate(expiryPreset, now)

    await db.transaction(async (tx) => {
      await tx
        .update(userSubscriptions)
        .set({ status: 'expired', updatedAt: now })
        .where(
          and(
            eq(userSubscriptions.userId, userId),
            inArray(userSubscriptions.status, ['active', 'grace_period']),
          ),
        )

      await tx.insert(userSubscriptions).values({
        userId,
        planId,
        duration,
        status: 'active',
        platform,
        currency: 'PKR',
        priceAtPurchase: '0',
        revenueCatProductId: `ohrny_${planId}_${duration}_${platform}`,
        revenueCatTransactionId: `admin_sub_${userId}_${now.getTime()}`,
        startedAt: now,
        expiresAt,
        updatedAt: now,
      })

      await syncUserPlanCache(userId, tx)
    })

    const entitlements = await getEffectiveEntitlements(userId)
    return res.json({
      ok: true,
      ...entitlementsSnapshot(entitlements),
    })
  } catch (err) {
    console.error('Admin grantUserSubscription error:', err)
    return res.status(500).json({ error: 'Failed to grant subscription' })
  }
}

export async function cancelUserSubscription(req, res) {
  try {
    const { userId } = req.params
    const user = await ensureActiveUser(userId)
    if (!user) return res.status(404).json({ error: 'User not found' })

    const now = new Date()

    await db.transaction(async (tx) => {
      await tx
        .update(userSubscriptions)
        .set({ status: 'cancelled', cancelledAt: now, updatedAt: now })
        .where(
          and(
            eq(userSubscriptions.userId, userId),
            inArray(userSubscriptions.status, ['active', 'grace_period']),
            or(
              isNull(userSubscriptions.expiresAt),
              sql`${userSubscriptions.expiresAt} > ${now}`,
              sql`${userSubscriptions.gracePeriodEndsAt} > ${now}`,
            ),
          ),
        )

      await syncUserPlanCache(userId, tx)
    })

    const entitlements = await getEffectiveEntitlements(userId)
    return res.json({
      ok: true,
      ...entitlementsSnapshot(entitlements),
    })
  } catch (err) {
    console.error('Admin cancelUserSubscription error:', err)
    return res.status(500).json({ error: 'Failed to cancel subscription' })
  }
}

export async function grantUserConsumables(req, res) {
  try {
    const { userId } = req.params
    const user = await ensureActiveUser(userId)
    if (!user) return res.status(404).json({ error: 'User not found' })

    const type = normalizeLower(req.body?.type)
    const platform = normalizeLower(req.body?.platform || 'ios')
    const quantity = Math.max(1, Math.min(1000, Math.round(Number(req.body?.quantity) || 0)))

    if (!ALLOWED_PURCHASE_TYPES.has(type)) return res.status(400).json({ error: 'Invalid purchase type' })
    if (!ALLOWED_PLATFORMS.has(platform)) return res.status(400).json({ error: 'Invalid platform' })
    if (!quantity) return res.status(400).json({ error: 'Quantity must be positive' })

    const now = new Date()
    const transactionId = `admin_purchase_${type}_${userId}_${now.getTime()}`

    const result = await grantPurchase({
      userId,
      type,
      quantity,
      priceAtPurchase: 0,
      currency: 'PKR',
      revenueCatProductId: `ohrny_${type === 'super_likes' ? 'superlikes' : 'boosts'}_${quantity}_${platform}`,
      revenueCatTransactionId: transactionId,
      platform,
      purchasedAt: now,
    })

    const entitlements = await getEffectiveEntitlements(userId)
    return res.json({
      ok: true,
      duplicate: Boolean(result?.duplicate),
      ...entitlementsSnapshot(entitlements),
    })
  } catch (err) {
    console.error('Admin grantUserConsumables error:', err)
    return res.status(500).json({ error: 'Failed to grant consumables' })
  }
}

function formatRelative(date) {
  if (!date) return '—'
  const now = Date.now()
  const then = new Date(date).getTime()
  const diff = now - then
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  return formatDate(date)
}

function formatDate(date) {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
