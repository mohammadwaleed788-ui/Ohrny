import { sql } from 'drizzle-orm'
import { db } from '../../../db/index.js'

const OPERATED_PHONE_COUNTRY = '+1'
const OPERATED_PHONE_PREFIX = '555019'

function subtractDays(date, days) {
  const d = new Date(date)
  d.setUTCDate(d.getUTCDate() - days)
  return d
}

function addDays(date, days) {
  const d = new Date(date)
  d.setUTCDate(d.getUTCDate() + days)
  return d
}

function startOfDay(date) {
  const d = new Date(date)
  d.setUTCHours(0, 0, 0, 0)
  return d
}

function startOfMonth(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
}

function addMonths(date, months) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1))
}

function rows(result) {
  return result.rows || result || []
}

function formatNum(n) {
  return Number(n || 0).toLocaleString('en-US')
}

function formatMoney(n) {
  const value = Number(n || 0)
  if (Math.abs(value) >= 1000000) return `$${(value / 1000000).toFixed(2)}M`
  if (Math.abs(value) >= 1000) return `$${(value / 1000).toFixed(1)}k`
  return `$${value.toFixed(0)}`
}

function formatSignedMoney(n) {
  const value = Number(n || 0)
  const abs = Math.abs(value)
  const sign = value >= 0 ? '+' : '-'
  if (abs >= 1000000) return `${sign}$${(abs / 1000000).toFixed(2)}M`
  if (abs >= 1000) return `${sign}$${(abs / 1000).toFixed(1)}k`
  return `${sign}$${abs.toFixed(0)}`
}

function formatPercentDelta(current, prior) {
  if (!prior || prior === 0) {
    if (!current) return '+0.0%'
    return '+∞'
  }
  const pct = ((current - prior) / prior) * 100
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`
}

function formatPpDelta(current, prior) {
  const delta = Number(current || 0) - Number(prior || 0)
  return `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}pp`
}

function padStart(arr, len) {
  const copy = [...arr]
  while (copy.length < len) copy.unshift(0)
  return copy.slice(-len)
}

function rangeToDays(range) {
  if (range === '24h') return 1
  if (range === '7d') return 7
  if (range === '90d') return 90
  if (range === 'ytd') return 365
  return 30
}

function compactLabel(range) {
  if (range === '24h') return '24h'
  if (range === '7d') return '7d'
  if (range === '90d') return '90d'
  if (range === 'ytd') return 'YTD'
  return '30d'
}

function buildLabels(days) {
  if (days <= 7) return ['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7']
  if (days <= 30) return ['W1', 'W2', 'W3', 'W4']
  if (days >= 365) return ['Q1', 'Q2', 'Q3', 'Q4', 'YTD']
  return ['M1', 'M2', 'M3']
}

function safeRate(numerator, denominator) {
  if (!denominator) return 0
  return (Number(numerator || 0) / Number(denominator || 0)) * 100
}

function planColor(planId) {
  if (planId === 'private') return 'oklch(0.72 0.15 25)'
  if (planId === 'platin') return 'oklch(0.82 0.14 80)'
  if (planId === 'plus') return 'oklch(0.75 0.12 235)'
  return 'oklch(0.55 0.06 260)'
}

function toConsumableLabel(type) {
  if (type === 'super_likes') return 'Super-likes'
  if (type === 'boosts') return 'Boost 30-min'
  if (type === 'read_receipts') return 'Read receipts'
  if (type === 'rewind') return 'Rewind'
  if (type === 'incognito') return 'Incognito'
  return type
}

function toPlanLabel(planId, rawName) {
  if (rawName) return rawName
  if (planId === 'platin') return 'Platinum'
  if (planId === 'plus') return 'Plus'
  if (planId === 'private') return 'Private'
  return String(planId || 'Unknown')
}

function toMonthLabel(date) {
  return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' })
}

function pct(value, total) {
  if (!total) return 0
  return (Number(value || 0) / Number(total || 0)) * 100
}

function parseRevenueScope(value) {
  const raw = String(value || 'all').trim().toLowerCase()
  if (raw === 'subscriptions' || raw === 'consumables') return raw
  return 'all'
}

function parseAgeFilter(value) {
  const raw = String(value || 'all').trim().toLowerCase()
  if (['18-24', '25-34', '35-44', '45+'].includes(raw)) return raw
  return 'all'
}

function parseGenderFilter(value) {
  const raw = String(value || 'all').trim().toLowerCase()
  if (['woman', 'man', 'nonbinary', 'other'].includes(raw)) return raw
  return 'all'
}

function parseCountryFilter(value) {
  const raw = String(value || 'all').trim().toUpperCase()
  if (!raw || raw === 'ALL') return 'all'
  return raw.slice(0, 4)
}

function parseDateOnly(value) {
  const raw = String(value || '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null
  const parsed = new Date(`${raw}T00:00:00.000Z`)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed
}

async function tryBillingEventsQuery(queryBuilder) {
  try {
    return await queryBuilder()
  } catch (err) {
    const message = String(err?.message || '')
    if (message.includes('billing_events') || message.includes('does not exist')) {
      return null
    }
    throw err
  }
}

export async function getRevenue(req, res) {
  try {
    const range = req.query.range || '30d'
    const revenueScope = parseRevenueScope(req.query.revenueScope)
    const ageFilter = parseAgeFilter(req.query.age)
    const genderFilter = parseGenderFilter(req.query.gender)
    const countryFilter = parseCountryFilter(req.query.country)
    const includeSubscriptions = revenueScope !== 'consumables'
    const includeConsumables = revenueScope !== 'subscriptions'
    const fromDate = parseDateOnly(req.query.from)
    const toDate = parseDateOnly(req.query.to)
    const isCustomRange = fromDate && toDate && fromDate <= toDate
    const fallbackDays = rangeToDays(range)
    const days = isCustomRange ? Math.max(1, Math.round((toDate - fromDate) / 86400000) + 1) : fallbackDays
    const rangeLabel = isCustomRange ? 'custom' : compactLabel(range)
    const now = new Date()
    const defaultToday = startOfDay(now)
    const periodStart = isCustomRange ? fromDate : subtractDays(defaultToday, days)
    const today = isCustomRange ? addDays(toDate, 1) : defaultToday
    const priorStart = subtractDays(periodStart, days)
    const operatedUserIdsSubquery = sql`
      SELECT id
      FROM users
      WHERE phone_country = ${OPERATED_PHONE_COUNTRY}
        AND phone LIKE ${`${OPERATED_PHONE_PREFIX}%`}
    `
    const filteredUsersWhere = [sql`u.id NOT IN (${operatedUserIdsSubquery})`]
    if (ageFilter === '18-24') filteredUsersWhere.push(sql`u.age BETWEEN 18 AND 24`)
    if (ageFilter === '25-34') filteredUsersWhere.push(sql`u.age BETWEEN 25 AND 34`)
    if (ageFilter === '35-44') filteredUsersWhere.push(sql`u.age BETWEEN 35 AND 44`)
    if (ageFilter === '45+') filteredUsersWhere.push(sql`u.age >= 45`)
    if (genderFilter !== 'all') filteredUsersWhere.push(sql`u.iam = ${genderFilter}`)
    if (countryFilter !== 'all') filteredUsersWhere.push(sql`u.country_code = ${countryFilter}`)
    const filteredUserIdsSubquery = sql`
      SELECT u.id
      FROM users u
      WHERE ${sql.join(filteredUsersWhere, sql` AND `)}
    `

    const [{ currentMrr }] = rows(await db.execute(sql`
      SELECT COALESCE(SUM(price_at_purchase::numeric), 0)::float as "currentMrr"
      FROM user_subscriptions
      WHERE status IN ('active', 'grace_period')
        AND user_id IN (${filteredUserIdsSubquery})
    `))

    const [{ priorMrr }] = rows(await db.execute(sql`
      SELECT COALESCE(SUM(price_at_purchase::numeric), 0)::float as "priorMrr"
      FROM user_subscriptions
      WHERE status IN ('active', 'expired', 'cancelled', 'grace_period')
        AND started_at < ${periodStart}
        AND (cancelled_at IS NULL OR cancelled_at >= ${periodStart})
        AND user_id IN (${filteredUserIdsSubquery})
    `))

    const [{ beforePriorMrr }] = rows(await db.execute(sql`
      SELECT COALESCE(SUM(price_at_purchase::numeric), 0)::float as "beforePriorMrr"
      FROM user_subscriptions
      WHERE status IN ('active', 'expired', 'cancelled', 'grace_period')
        AND started_at < ${priorStart}
        AND (cancelled_at IS NULL OR cancelled_at >= ${priorStart})
        AND user_id IN (${filteredUserIdsSubquery})
    `))

    const netNewMrr = Number(currentMrr || 0) - Number(priorMrr || 0)
    const priorNetNewMrr = Number(priorMrr || 0) - Number(beforePriorMrr || 0)

    const [{ payingUsers }] = rows(await db.execute(sql`
      SELECT COUNT(DISTINCT user_id)::int as "payingUsers"
      FROM user_subscriptions
      WHERE status IN ('active', 'grace_period')
        AND user_id IN (${filteredUserIdsSubquery})
    `))
    const [{ payingUsersPrior }] = rows(await db.execute(sql`
      SELECT COUNT(DISTINCT user_id)::int as "payingUsersPrior"
      FROM user_subscriptions
      WHERE status IN ('active', 'expired', 'cancelled', 'grace_period')
        AND started_at < ${periodStart}
        AND (cancelled_at IS NULL OR cancelled_at >= ${periodStart})
        AND user_id IN (${filteredUserIdsSubquery})
    `))

    const [{ churnCancelled }] = rows(await db.execute(sql`
      SELECT COUNT(DISTINCT user_id)::int as "churnCancelled"
      FROM user_subscriptions
      WHERE cancelled_at >= ${periodStart}
        AND cancelled_at < ${today}
        AND user_id IN (${filteredUserIdsSubquery})
    `))
    const [{ churnCancelledPrior }] = rows(await db.execute(sql`
      SELECT COUNT(DISTINCT user_id)::int as "churnCancelledPrior"
      FROM user_subscriptions
      WHERE cancelled_at >= ${priorStart}
        AND cancelled_at < ${periodStart}
        AND user_id IN (${filteredUserIdsSubquery})
    `))
    const [{ activeAtPeriodStart }] = rows(await db.execute(sql`
      SELECT COUNT(DISTINCT user_id)::int as "activeAtPeriodStart"
      FROM user_subscriptions
      WHERE started_at < ${periodStart}
        AND status IN ('active', 'expired', 'cancelled', 'grace_period')
        AND (cancelled_at IS NULL OR cancelled_at >= ${periodStart})
        AND user_id IN (${filteredUserIdsSubquery})
    `))
    const [{ activeAtPriorStart }] = rows(await db.execute(sql`
      SELECT COUNT(DISTINCT user_id)::int as "activeAtPriorStart"
      FROM user_subscriptions
      WHERE started_at < ${priorStart}
        AND status IN ('active', 'expired', 'cancelled', 'grace_period')
        AND (cancelled_at IS NULL OR cancelled_at >= ${priorStart})
        AND user_id IN (${filteredUserIdsSubquery})
    `))

    const churnRate = safeRate(churnCancelled, activeAtPeriodStart)
    const churnRatePrior = safeRate(churnCancelledPrior, activeAtPriorStart)

    const mrrSeriesRows = rows(await db.execute(sql`
      SELECT DATE(started_at AT TIME ZONE 'UTC') as day, COALESCE(SUM(price_at_purchase::numeric), 0)::float as total
      FROM user_subscriptions
      WHERE started_at >= ${periodStart}
        AND started_at < ${today}
        AND user_id IN (${filteredUserIdsSubquery})
      GROUP BY day
      ORDER BY day
    `))
    const mrrPriorSeriesRows = rows(await db.execute(sql`
      SELECT DATE(started_at AT TIME ZONE 'UTC') as day, COALESCE(SUM(price_at_purchase::numeric), 0)::float as total
      FROM user_subscriptions
      WHERE started_at >= ${priorStart}
        AND started_at < ${periodStart}
        AND user_id IN (${filteredUserIdsSubquery})
      GROUP BY day
      ORDER BY day
    `))

    const sparkDays = 14
    const sparkStart = subtractDays(today, sparkDays)
    const sparkSubsRows = rows(await db.execute(sql`
      SELECT DATE(started_at AT TIME ZONE 'UTC') as day, COALESCE(SUM(price_at_purchase::numeric), 0)::float as total
      FROM user_subscriptions
      WHERE started_at >= ${sparkStart}
        AND user_id IN (${filteredUserIdsSubquery})
      GROUP BY day
      ORDER BY day
    `))

    const sparkSeries = padStart(sparkSubsRows.map((r) => Number(r.total || 0)), sparkDays)
    const netNewSpark = sparkSeries.map((value, idx) => Math.max(0, value - (sparkSeries[idx - 1] || 0)))
    const usersSparkRows = rows(await db.execute(sql`
      SELECT DATE(started_at AT TIME ZONE 'UTC') as day, COUNT(DISTINCT user_id)::int as total
      FROM user_subscriptions
      WHERE started_at >= ${sparkStart}
        AND user_id IN (${filteredUserIdsSubquery})
      GROUP BY day
      ORDER BY day
    `))
    const usersSpark = padStart(usersSparkRows.map((r) => Number(r.total || 0)), sparkDays)

    const planRows = rows(await db.execute(sql`
      SELECT
        us.plan_id as "planId",
        sp.name as "planName",
        COUNT(*)::int as subscribers,
        COALESCE(SUM(us.price_at_purchase::numeric), 0)::float as revenue
      FROM user_subscriptions us
      LEFT JOIN subscription_plans sp ON sp.id = us.plan_id
      WHERE us.status IN ('active', 'grace_period')
        AND us.user_id IN (${filteredUserIdsSubquery})
      GROUP BY us.plan_id, sp.name
      ORDER BY subscribers DESC
    `))

    const planSegments = planRows.map((row) => ({
      label: toPlanLabel(row.planId, row.planName),
      value: Number(row.subscribers || 0),
      color: planColor(row.planId),
    }))
    const planMixRows = planRows.map((row) => {
      const revenue = Number(row.revenue || 0)
      const count = Number(row.subscribers || 0)
      const arpu = count > 0 ? revenue / count : 0
      return {
        planId: row.planId,
        name: toPlanLabel(row.planId, row.planName),
        count,
        revenue,
        arpu,
        color: planColor(row.planId),
      }
    })

    const inAppConsumablesRows = rows(await db.execute(sql`
      SELECT type, COALESCE(SUM(quantity), 0)::int as units, COALESCE(SUM(price_at_purchase::numeric), 0)::float as revenue
      FROM in_app_purchases
      WHERE purchased_at >= ${periodStart}
        AND user_id IN (${filteredUserIdsSubquery})
      GROUP BY type
    `))

    const billingConsumables = await tryBillingEventsQuery(() => db.execute(sql`
      SELECT consumable_type as type, COALESCE(SUM(amount::numeric), 0)::float as revenue
      FROM billing_events
      WHERE metric_kind = 'consumable'
        AND occurred_at >= ${periodStart}
        AND (user_id IS NULL OR user_id IN (${filteredUserIdsSubquery}))
      GROUP BY consumable_type
    `))

    const consumablesMap = new Map([
      ['super_likes', { type: 'super_likes', units: 0, revenue: 0 }],
      ['boosts', { type: 'boosts', units: 0, revenue: 0 }],
      ['read_receipts', { type: 'read_receipts', units: 0, revenue: 0 }],
      ['rewind', { type: 'rewind', units: 0, revenue: 0 }],
      ['incognito', { type: 'incognito', units: 0, revenue: 0 }],
    ])

    for (const row of inAppConsumablesRows) {
      const key = String(row.type)
      if (!consumablesMap.has(key)) consumablesMap.set(key, { type: key, units: 0, revenue: 0 })
      const current = consumablesMap.get(key)
      current.units += Number(row.units || 0)
      current.revenue += Number(row.revenue || 0)
    }

    if (billingConsumables) {
      for (const row of rows(billingConsumables)) {
        const key = String(row.type || '')
        if (!key) continue
        if (!consumablesMap.has(key)) consumablesMap.set(key, { type: key, units: 0, revenue: 0 })
        const current = consumablesMap.get(key)
        current.revenue += Number(row.revenue || 0)
      }
    }

    const consumables = [...consumablesMap.values()]
      .map((item) => ({
        type: item.type,
        label: toConsumableLabel(item.type),
        units: Number(item.units || 0),
        revenue: Number(item.revenue || 0),
      }))
      .sort((a, b) => b.revenue - a.revenue)

    const countryRevenueRows = rows(await db.execute(sql`
      SELECT
        u.country_code as country,
        COALESCE(SUM(us.price_at_purchase::numeric), 0)::float as sub_revenue
      FROM user_subscriptions us
      JOIN users u ON u.id = us.user_id
      WHERE us.started_at >= ${periodStart}
        AND us.started_at < ${today}
        AND u.country_code IS NOT NULL
        AND us.user_id IN (${filteredUserIdsSubquery})
      GROUP BY u.country_code
    `))

    const countryIapRows = rows(await db.execute(sql`
      SELECT
        u.country_code as country,
        COALESCE(SUM(iap.price_at_purchase::numeric), 0)::float as iap_revenue
      FROM in_app_purchases iap
      JOIN users u ON u.id = iap.user_id
      WHERE iap.purchased_at >= ${periodStart}
        AND iap.purchased_at < ${today}
        AND u.country_code IS NOT NULL
        AND iap.user_id IN (${filteredUserIdsSubquery})
      GROUP BY u.country_code
    `))

    const countryPayingRows = rows(await db.execute(sql`
      SELECT
        u.country_code as country,
        COUNT(DISTINCT us.user_id)::int as paying_users
      FROM user_subscriptions us
      JOIN users u ON u.id = us.user_id
      WHERE us.status IN ('active', 'grace_period')
        AND u.country_code IS NOT NULL
        AND us.user_id IN (${filteredUserIdsSubquery})
      GROUP BY u.country_code
    `))

    const countrySignupsRows = rows(await db.execute(sql`
      SELECT
        country_code as country,
        COUNT(*)::int as signups
      FROM users
      WHERE deleted_at IS NULL
        AND country_code IS NOT NULL
        AND id IN (${filteredUserIdsSubquery})
      GROUP BY country_code
    `))

    const countriesMap = new Map()
    const ensureCountry = (country) => {
      const key = String(country || '').toUpperCase()
      if (!key) return null
      if (!countriesMap.has(key)) {
        countriesMap.set(key, {
          country: key,
          revenue: 0,
          payingUsers: 0,
          signups: 0,
        })
      }
      return countriesMap.get(key)
    }

    if (includeSubscriptions) {
      for (const row of countryRevenueRows) {
        const item = ensureCountry(row.country)
        if (!item) continue
        item.revenue += Number(row.sub_revenue || 0)
      }
    }
    if (includeConsumables) {
      for (const row of countryIapRows) {
        const item = ensureCountry(row.country)
        if (!item) continue
        item.revenue += Number(row.iap_revenue || 0)
      }
    }
    if (includeSubscriptions) {
      for (const row of countryPayingRows) {
        const item = ensureCountry(row.country)
        if (!item) continue
        item.payingUsers = Number(row.paying_users || 0)
      }
    }
    for (const row of countrySignupsRows) {
      const item = ensureCountry(row.country)
      if (!item) continue
      item.signups = Number(row.signups || 0)
    }

    const countries = [...countriesMap.values()].sort((a, b) => b.revenue - a.revenue)
    const countriesTop = countries.slice(0, 10)
    const totalCountryRevenue = countries.reduce((sum, item) => sum + Number(item.revenue || 0), 0)
    const totalCountryPayingUsers = countries.reduce((sum, item) => sum + Number(item.payingUsers || 0), 0)
    const totalCountrySignups = countries.reduce((sum, item) => sum + Number(item.signups || 0), 0)
    const totalConversionRate = pct(totalCountryPayingUsers, totalCountrySignups)

    const [{ signupsBeforePeriod }] = rows(await db.execute(sql`
      SELECT COUNT(*)::int as "signupsBeforePeriod"
      FROM users
      WHERE deleted_at IS NULL
        AND created_at < ${periodStart}
        AND id IN (${filteredUserIdsSubquery})
    `))
    const conversionRatePrior = pct(includeSubscriptions ? Number(payingUsersPrior || 0) : 0, Number(signupsBeforePeriod || 0))

    const [{ appDownloads }] = rows(await db.execute(sql`
      SELECT COUNT(*)::int as "appDownloads"
      FROM activity_events
      WHERE event = 'app_open'
        AND created_at >= ${periodStart}
        AND created_at < ${today}
        AND user_id IN (${filteredUserIdsSubquery})
    `))
    const [{ appDownloadsPrior }] = rows(await db.execute(sql`
      SELECT COUNT(*)::int as "appDownloadsPrior"
      FROM activity_events
      WHERE event = 'app_open'
        AND created_at >= ${priorStart}
        AND created_at < ${periodStart}
        AND user_id IN (${filteredUserIdsSubquery})
    `))
    const [{ completedProfiles }] = rows(await db.execute(sql`
      SELECT COUNT(*)::int as "completedProfiles"
      FROM users
      WHERE deleted_at IS NULL
        AND created_at >= ${periodStart}
        AND created_at < ${today}
        AND profile_complete_pct >= 80
        AND id IN (${filteredUserIdsSubquery})
    `))
    const [{ completedProfilesPrior }] = rows(await db.execute(sql`
      SELECT COUNT(*)::int as "completedProfilesPrior"
      FROM users
      WHERE deleted_at IS NULL
        AND created_at >= ${priorStart}
        AND created_at < ${periodStart}
        AND profile_complete_pct >= 80
        AND id IN (${filteredUserIdsSubquery})
    `))
    const [{ subscriptionsFromNewUsers }] = rows(await db.execute(sql`
      SELECT COUNT(DISTINCT us.user_id)::int as "subscriptionsFromNewUsers"
      FROM user_subscriptions us
      WHERE us.started_at >= ${periodStart}
        AND us.started_at < ${today}
        AND us.price_at_purchase::numeric > 0
        AND us.user_id IN (${filteredUserIdsSubquery})
    `))
    const [{ subscriptionsFromNewUsersPrior }] = rows(await db.execute(sql`
      SELECT COUNT(DISTINCT us.user_id)::int as "subscriptionsFromNewUsersPrior"
      FROM user_subscriptions us
      WHERE us.started_at >= ${priorStart}
        AND us.started_at < ${periodStart}
        AND us.price_at_purchase::numeric > 0
        AND us.user_id IN (${filteredUserIdsSubquery})
    `))

    const funnelDownloads = Number(appDownloads || 0)
    const funnelCompleted = Number(completedProfiles || 0)
    const funnelSubscribed = Number(subscriptionsFromNewUsers || 0)

    const sparkSignupsRows = rows(await db.execute(sql`
      SELECT DATE(created_at AT TIME ZONE 'UTC') as day, COUNT(*)::int as total
      FROM users
      WHERE created_at >= ${sparkStart}
        AND deleted_at IS NULL
        AND id IN (${filteredUserIdsSubquery})
      GROUP BY day
      ORDER BY day
    `))
    const sparkNewPayingRows = rows(await db.execute(sql`
      SELECT DATE(started_at AT TIME ZONE 'UTC') as day, COUNT(DISTINCT user_id)::int as total
      FROM user_subscriptions
      WHERE started_at >= ${sparkStart}
        AND price_at_purchase::numeric > 0
        AND user_id IN (${filteredUserIdsSubquery})
      GROUP BY day
      ORDER BY day
    `))
    const signupsSeries = padStart(sparkSignupsRows.map((r) => Number(r.total || 0)), sparkDays)
    const payingSeries = padStart(sparkNewPayingRows.map((r) => Number(r.total || 0)), sparkDays)
    let cumulativeSignups = 0
    let cumulativePaying = 0
    const conversionSeries = signupsSeries.map((count, idx) => {
      cumulativeSignups += Number(count || 0)
      cumulativePaying += Number(payingSeries[idx] || 0)
      return Number(safeRate(cumulativePaying, cumulativeSignups).toFixed(2))
    })

    const cohorts = []
    const firstCohort = addMonths(startOfMonth(today), -5)
    for (let i = 0; i < 6; i++) {
      const cohortStart = addMonths(firstCohort, i)
      const cohortEnd = addMonths(cohortStart, 1)
      const cohortSizeRows = rows(await db.execute(sql`
        SELECT COUNT(DISTINCT user_id)::int as size
        FROM user_subscriptions
        WHERE started_at >= ${cohortStart}
          AND started_at < ${cohortEnd}
          AND price_at_purchase::numeric > 0
          AND user_id IN (${filteredUserIdsSubquery})
      `))
      const cohortSize = Number(cohortSizeRows[0]?.size || 0)
      const months = []

      for (let offset = 1; offset <= 6; offset++) {
        const snapshot = addMonths(cohortStart, offset)
        if (snapshot > now) {
          months.push(null)
          continue
        }
        if (!cohortSize) {
          months.push(0)
          continue
        }
        const retainedRows = rows(await db.execute(sql`
          SELECT COUNT(DISTINCT user_id)::int as retained
          FROM user_subscriptions
          WHERE user_id IN (
            SELECT DISTINCT user_id
            FROM user_subscriptions
            WHERE started_at >= ${cohortStart}
              AND started_at < ${cohortEnd}
              AND price_at_purchase::numeric > 0
              AND user_id IN (${filteredUserIdsSubquery})
          )
            AND started_at < ${snapshot}
            AND status IN ('active', 'expired', 'cancelled', 'grace_period')
            AND (cancelled_at IS NULL OR cancelled_at >= ${snapshot})
        `))
        const retained = Number(retainedRows[0]?.retained || 0)
        months.push(Math.round((retained / cohortSize) * 100))
      }

      cohorts.push({
        cohort: toMonthLabel(cohortStart),
        months,
      })
    }

    const trialRows = await tryBillingEventsQuery(() => db.execute(sql`
      SELECT
        COALESCE(SUM(CASE WHEN event_type = 'trial_started' THEN 1 ELSE 0 END), 0)::int as started,
        COALESCE(SUM(CASE WHEN event_type = 'trial_converted' THEN 1 ELSE 0 END), 0)::int as converted
      FROM billing_events
      WHERE occurred_at >= ${periodStart}
        AND (user_id IS NULL OR user_id IN (${filteredUserIdsSubquery}))
    `))
    const trialStarted = Number(rows(trialRows || [])[0]?.started || 0)
    const trialConverted = Number(rows(trialRows || [])[0]?.converted || 0)
    const trialToPaid = safeRate(trialConverted, trialStarted)

    const refundRows = await tryBillingEventsQuery(() => db.execute(sql`
      SELECT COALESCE(SUM(ABS(amount::numeric)), 0)::float as refunded
      FROM billing_events
      WHERE metric_kind = 'refund'
        AND occurred_at >= ${periodStart}
        AND (user_id IS NULL OR user_id IN (${filteredUserIdsSubquery}))
    `))
    const refundedAmount = Number(rows(refundRows || [])[0]?.refunded || 0)
    const periodSubscriptionRevenueRows = rows(await db.execute(sql`
      SELECT COALESCE(SUM(price_at_purchase::numeric), 0)::float as revenue
      FROM user_subscriptions
      WHERE started_at >= ${periodStart}
        AND started_at < ${today}
        AND user_id IN (${filteredUserIdsSubquery})
    `))
    const periodSubscriptionRevenue = Number(periodSubscriptionRevenueRows[0]?.revenue || 0)
    const refundRate = safeRate(refundedAmount, periodSubscriptionRevenue)
    const mrrValue = includeSubscriptions ? Number(currentMrr || 0) : 0
    const priorMrrValue = includeSubscriptions ? Number(priorMrr || 0) : 0
    const netNewMrrValue = includeSubscriptions ? Number(netNewMrr || 0) : 0
    const priorNetNewMrrValue = includeSubscriptions ? Number(priorNetNewMrr || 0) : 0
    const payingUsersValue = includeSubscriptions ? Number(payingUsers || 0) : 0
    const payingUsersPriorValue = includeSubscriptions ? Number(payingUsersPrior || 0) : 0
    const churnRateValue = includeSubscriptions ? Number(churnRate || 0) : 0
    const churnRatePriorValue = includeSubscriptions ? Number(churnRatePrior || 0) : 0
    const mrrCurrentSeries = includeSubscriptions ? padStart(mrrSeriesRows.map((r) => Number(r.total || 0)), days) : Array(days).fill(0)
    const mrrPriorSeries = includeSubscriptions ? padStart(mrrPriorSeriesRows.map((r) => Number(r.total || 0)), days) : Array(days).fill(0)
    const mrrSparkSeries = includeSubscriptions ? sparkSeries : Array(sparkDays).fill(0)
    const netNewSparkSeries = includeSubscriptions ? netNewSpark : Array(sparkDays).fill(0)
    const usersSparkSeries = includeSubscriptions ? usersSpark : Array(sparkDays).fill(0)
    const planSegmentsValue = includeSubscriptions ? planSegments : []
    const planMixRowsValue = includeSubscriptions ? planMixRows : []
    const consumablesValue = includeConsumables ? consumables : consumables.map((item) => ({ ...item, units: 0, revenue: 0 }))
    const funnelSubscribedValue = includeSubscriptions ? Number(funnelSubscribed || 0) : 0
    const funnelSubscribedPriorValue = includeSubscriptions ? Number(subscriptionsFromNewUsersPrior || 0) : 0
    const cohortsValue = includeSubscriptions ? cohorts : []
    const refundRateValue = includeSubscriptions ? refundRate : 0
    const trialToPaidValue = includeSubscriptions ? trialToPaid : 0
    const trialStartedValue = includeSubscriptions ? trialStarted : 0
    const trialConvertedValue = includeSubscriptions ? trialConverted : 0

    return res.json({
      kpis: {
        mrr: {
          v: formatMoney(mrrValue),
          d: formatPercentDelta(mrrValue, priorMrrValue),
          t: `vs prior ${rangeLabel}`,
          series: mrrSparkSeries,
        },
        netNewMrr: {
          v: formatSignedMoney(netNewMrrValue),
          d: formatPercentDelta(netNewMrrValue, priorNetNewMrrValue),
          t: `in ${rangeLabel}`,
          series: netNewSparkSeries,
        },
        payingUsers: {
          v: formatNum(payingUsersValue),
          d: `${payingUsersValue - payingUsersPriorValue >= 0 ? '+' : ''}${formatNum(payingUsersValue - payingUsersPriorValue)}`,
          t: 'subscribers',
          series: usersSparkSeries,
        },
        conversionRate: {
          v: `${totalConversionRate.toFixed(1)}%`,
          d: formatPpDelta(totalConversionRate, conversionRatePrior),
          t: 'signup → paying',
          series: conversionSeries,
        },
        churn: {
          v: `${churnRateValue.toFixed(1)}%`,
          d: formatPpDelta(churnRateValue, churnRatePriorValue),
          t: 'monthly',
          series: mrrSparkSeries.map((n, idx) => {
            const prev = mrrSparkSeries[idx - 1] || n || 1
            return Number(((Math.max(0, prev - n) / Math.max(prev, 1)) * 100).toFixed(2))
          }),
        },
        refundRate: {
          v: `${refundRateValue.toFixed(1)}%`,
          d: '',
          t: `of ${rangeLabel} subscription rev`,
        },
        trialToPaid: {
          v: `${trialToPaidValue.toFixed(1)}%`,
          d: '',
          t: `${trialConvertedValue}/${Math.max(trialStartedValue, 1)} converted`,
        },
      },
      mrrChart: {
        current: mrrCurrentSeries,
        prior: mrrPriorSeries,
        labels: buildLabels(days),
      },
      planMix: {
        segments: planSegmentsValue,
        rows: planMixRowsValue,
      },
      consumables: consumablesValue,
      consumablesTotal: consumablesValue.reduce((sum, row) => sum + Number(row.revenue || 0), 0),
      funnel: {
        appDownloads: {
          v: funnelDownloads,
          pctOfDownloads: 100,
          dropFromPrev: null,
          d: formatPercentDelta(funnelDownloads, Number(appDownloadsPrior || 0)),
        },
        completedProfile: {
          v: funnelCompleted,
          pctOfDownloads: safeRate(funnelCompleted, funnelDownloads),
          dropFromPrev: safeRate(Math.max(funnelDownloads - funnelCompleted, 0), funnelDownloads),
          d: formatPercentDelta(funnelCompleted, Number(completedProfilesPrior || 0)),
        },
        subscription: {
          v: funnelSubscribedValue,
          pctOfDownloads: safeRate(funnelSubscribedValue, funnelDownloads),
          dropFromPrev: safeRate(Math.max(funnelCompleted - funnelSubscribedValue, 0), funnelCompleted),
          d: formatPercentDelta(funnelSubscribedValue, funnelSubscribedPriorValue),
        },
      },
      countries: countriesTop.map((item) => ({
        country: item.country,
        revenue: item.revenue,
        share: pct(item.revenue, totalCountryRevenue),
        payingUsers: item.payingUsers,
        signups: item.signups,
        conversionRate: pct(item.payingUsers, item.signups),
      })),
      countriesTotal: {
        revenue: totalCountryRevenue,
        payingUsers: totalCountryPayingUsers,
        signups: totalCountrySignups,
        conversionRate: totalConversionRate,
      },
      cohorts: cohortsValue,
    })
  } catch (err) {
    console.error('Revenue API error:', err)
    return res.status(500).json({ error: 'Failed to load revenue data' })
  }
}
