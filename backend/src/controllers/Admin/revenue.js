import { sql } from 'drizzle-orm'
import { db } from '../../../db/index.js'

function subtractDays(date, days) {
  const d = new Date(date)
  d.setUTCDate(d.getUTCDate() - days)
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
  return 30
}

function compactLabel(range) {
  if (range === '24h') return '24h'
  if (range === '7d') return '7d'
  if (range === '90d') return '90d'
  return '30d'
}

function buildLabels(days) {
  if (days <= 7) return ['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7']
  if (days <= 30) return ['W1', 'W2', 'W3', 'W4']
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
    const days = rangeToDays(range)
    const rangeLabel = compactLabel(range)
    const now = new Date()
    const today = startOfDay(now)
    const periodStart = subtractDays(today, days)
    const priorStart = subtractDays(periodStart, days)
    const beforePriorStart = subtractDays(priorStart, days)

    const [{ currentMrr }] = rows(await db.execute(sql`
      SELECT COALESCE(SUM(price_at_purchase::numeric), 0)::float as "currentMrr"
      FROM user_subscriptions
      WHERE status IN ('active', 'grace_period')
    `))

    const [{ priorMrr }] = rows(await db.execute(sql`
      SELECT COALESCE(SUM(price_at_purchase::numeric), 0)::float as "priorMrr"
      FROM user_subscriptions
      WHERE status IN ('active', 'expired', 'cancelled', 'grace_period')
        AND started_at < ${periodStart}
        AND (cancelled_at IS NULL OR cancelled_at >= ${periodStart})
    `))

    const [{ beforePriorMrr }] = rows(await db.execute(sql`
      SELECT COALESCE(SUM(price_at_purchase::numeric), 0)::float as "beforePriorMrr"
      FROM user_subscriptions
      WHERE status IN ('active', 'expired', 'cancelled', 'grace_period')
        AND started_at < ${priorStart}
        AND (cancelled_at IS NULL OR cancelled_at >= ${priorStart})
    `))

    const netNewMrr = Number(currentMrr || 0) - Number(priorMrr || 0)
    const priorNetNewMrr = Number(priorMrr || 0) - Number(beforePriorMrr || 0)

    const [{ payingUsers }] = rows(await db.execute(sql`
      SELECT COUNT(DISTINCT user_id)::int as "payingUsers"
      FROM user_subscriptions
      WHERE status IN ('active', 'grace_period')
    `))
    const [{ payingUsersPrior }] = rows(await db.execute(sql`
      SELECT COUNT(DISTINCT user_id)::int as "payingUsersPrior"
      FROM user_subscriptions
      WHERE status IN ('active', 'expired', 'cancelled', 'grace_period')
        AND started_at < ${periodStart}
        AND (cancelled_at IS NULL OR cancelled_at >= ${periodStart})
    `))

    const [{ churnCancelled }] = rows(await db.execute(sql`
      SELECT COUNT(DISTINCT user_id)::int as "churnCancelled"
      FROM user_subscriptions
      WHERE cancelled_at >= ${periodStart}
        AND cancelled_at < ${today}
    `))
    const [{ churnCancelledPrior }] = rows(await db.execute(sql`
      SELECT COUNT(DISTINCT user_id)::int as "churnCancelledPrior"
      FROM user_subscriptions
      WHERE cancelled_at >= ${priorStart}
        AND cancelled_at < ${periodStart}
    `))
    const [{ activeAtPeriodStart }] = rows(await db.execute(sql`
      SELECT COUNT(DISTINCT user_id)::int as "activeAtPeriodStart"
      FROM user_subscriptions
      WHERE started_at < ${periodStart}
        AND status IN ('active', 'expired', 'cancelled', 'grace_period')
        AND (cancelled_at IS NULL OR cancelled_at >= ${periodStart})
    `))
    const [{ activeAtPriorStart }] = rows(await db.execute(sql`
      SELECT COUNT(DISTINCT user_id)::int as "activeAtPriorStart"
      FROM user_subscriptions
      WHERE started_at < ${priorStart}
        AND status IN ('active', 'expired', 'cancelled', 'grace_period')
        AND (cancelled_at IS NULL OR cancelled_at >= ${priorStart})
    `))

    const churnRate = safeRate(churnCancelled, activeAtPeriodStart)
    const churnRatePrior = safeRate(churnCancelledPrior, activeAtPriorStart)

    const mrrSeriesRows = rows(await db.execute(sql`
      SELECT DATE(started_at AT TIME ZONE 'UTC') as day, COALESCE(SUM(price_at_purchase::numeric), 0)::float as total
      FROM user_subscriptions
      WHERE started_at >= ${periodStart}
        AND started_at < ${today}
      GROUP BY day
      ORDER BY day
    `))
    const mrrPriorSeriesRows = rows(await db.execute(sql`
      SELECT DATE(started_at AT TIME ZONE 'UTC') as day, COALESCE(SUM(price_at_purchase::numeric), 0)::float as total
      FROM user_subscriptions
      WHERE started_at >= ${priorStart}
        AND started_at < ${periodStart}
      GROUP BY day
      ORDER BY day
    `))

    const sparkDays = 14
    const sparkStart = subtractDays(today, sparkDays)
    const sparkSubsRows = rows(await db.execute(sql`
      SELECT DATE(started_at AT TIME ZONE 'UTC') as day, COALESCE(SUM(price_at_purchase::numeric), 0)::float as total
      FROM user_subscriptions
      WHERE started_at >= ${sparkStart}
      GROUP BY day
      ORDER BY day
    `))

    const sparkSeries = padStart(sparkSubsRows.map((r) => Number(r.total || 0)), sparkDays)
    const netNewSpark = sparkSeries.map((value, idx) => Math.max(0, value - (sparkSeries[idx - 1] || 0)))
    const usersSparkRows = rows(await db.execute(sql`
      SELECT DATE(started_at AT TIME ZONE 'UTC') as day, COUNT(DISTINCT user_id)::int as total
      FROM user_subscriptions
      WHERE started_at >= ${sparkStart}
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
      GROUP BY type
    `))

    const billingConsumables = await tryBillingEventsQuery(() => db.execute(sql`
      SELECT consumable_type as type, COALESCE(SUM(amount::numeric), 0)::float as revenue
      FROM billing_events
      WHERE metric_kind = 'consumable'
        AND occurred_at >= ${periodStart}
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
    `))
    const trialStarted = Number(rows(trialRows || [])[0]?.started || 0)
    const trialConverted = Number(rows(trialRows || [])[0]?.converted || 0)
    const trialToPaid = safeRate(trialConverted, trialStarted)

    const refundRows = await tryBillingEventsQuery(() => db.execute(sql`
      SELECT COALESCE(SUM(ABS(amount::numeric)), 0)::float as refunded
      FROM billing_events
      WHERE metric_kind = 'refund'
        AND occurred_at >= ${periodStart}
    `))
    const refundedAmount = Number(rows(refundRows || [])[0]?.refunded || 0)
    const periodSubscriptionRevenueRows = rows(await db.execute(sql`
      SELECT COALESCE(SUM(price_at_purchase::numeric), 0)::float as revenue
      FROM user_subscriptions
      WHERE started_at >= ${periodStart}
        AND started_at < ${today}
    `))
    const periodSubscriptionRevenue = Number(periodSubscriptionRevenueRows[0]?.revenue || 0)
    const refundRate = safeRate(refundedAmount, periodSubscriptionRevenue)

    return res.json({
      kpis: {
        mrr: {
          v: formatMoney(currentMrr),
          d: formatPercentDelta(currentMrr, priorMrr),
          t: `vs prior ${rangeLabel}`,
          series: sparkSeries,
        },
        netNewMrr: {
          v: formatSignedMoney(netNewMrr),
          d: formatPercentDelta(netNewMrr, priorNetNewMrr),
          t: `in ${rangeLabel}`,
          series: netNewSpark,
        },
        payingUsers: {
          v: formatNum(payingUsers),
          d: `${Number(payingUsers || 0) - Number(payingUsersPrior || 0) >= 0 ? '+' : ''}${formatNum(Number(payingUsers || 0) - Number(payingUsersPrior || 0))}`,
          t: 'subscribers',
          series: usersSpark,
        },
        churn: {
          v: `${churnRate.toFixed(1)}%`,
          d: formatPpDelta(churnRate, churnRatePrior),
          t: 'monthly',
          series: sparkSeries.map((n, idx) => {
            const prev = sparkSeries[idx - 1] || n || 1
            return Number(((Math.max(0, prev - n) / Math.max(prev, 1)) * 100).toFixed(2))
          }),
        },
        refundRate: {
          v: `${refundRate.toFixed(1)}%`,
          d: '',
          t: `of ${rangeLabel} subscription rev`,
        },
        trialToPaid: {
          v: `${trialToPaid.toFixed(1)}%`,
          d: '',
          t: `${trialConverted}/${Math.max(trialStarted, 1)} converted`,
        },
      },
      mrrChart: {
        current: padStart(mrrSeriesRows.map((r) => Number(r.total || 0)), days),
        prior: padStart(mrrPriorSeriesRows.map((r) => Number(r.total || 0)), days),
        labels: buildLabels(days),
      },
      planMix: {
        segments: planSegments,
        rows: planMixRows,
      },
      consumables,
      consumablesTotal: consumables.reduce((sum, row) => sum + Number(row.revenue || 0), 0),
      cohorts,
    })
  } catch (err) {
    console.error('Revenue API error:', err)
    return res.status(500).json({ error: 'Failed to load revenue data' })
  }
}
