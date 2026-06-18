import { sql, eq, and, gte, lte, count, isNull, inArray } from 'drizzle-orm'
import { db } from '../../../db/index.js'
import { users } from '../../../db/schema/users.js'
import { matches } from '../../../db/schema/matching.js'
import { likes } from '../../../db/schema/matching.js'
import { userSubscriptions, inAppPurchases } from '../../../db/schema/subscriptions.js'
import { appeals, reports, userEnforcements } from '../../../db/schema/safety.js'
import { userDevices } from '../../../db/schema/userDevices.js'
import { getIO } from '../../socket/index.js'

function rangeToSpan(range) {
  switch (range) {
    case '24h': return { days: 1, points: 24, labelType: 'hours' }
    case '7d': return { days: 7, points: 7, labelType: 'weekdays' }
    case '30d': return { days: 30, points: 30, labelType: 'weeks' }
    case '90d': return { days: 90, points: 90, labelType: 'months' }
    default: return { days: 7, points: 7, labelType: 'weekdays' }
  }
}

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

function formatNum(n) {
  return n.toLocaleString('en-US')
}

function formatDelta(current, previous) {
  if (!previous || previous === 0) {
    if (current === 0) return '+0.0%'
    return '+∞'
  }
  const pct = ((current - previous) / previous) * 100
  const sign = pct >= 0 ? '+' : ''
  return `${sign}${pct.toFixed(1)}%`
}

function buildLabels(range, points) {
  if (range === '24h') {
    const labels = []
    for (let i = 0; i < Math.min(points, 7); i++) {
      const h = Math.round((i / 6) * 23)
      labels.push(`${h}:00`)
    }
    return labels
  } else if (range === '7d') {
    return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  } else if (range === '30d') {
    return ['W-4', 'W-3', 'W-2', 'W-1', 'Now']
  } else if (range === '90d') {
    return ['-90d', '-60d', '-30d', 'Now']
  }
  return []
}

function pad(arr, len) {
  const copy = [...arr]
  while (copy.length < len) copy.unshift(0)
  return copy.slice(-len)
}

function rows(result) {
  return result.rows || result || []
}

export async function getOverview(req, res) {
  try {
    const range = req.query.range || '7d'
    const { days } = rangeToSpan(range)

    const now = new Date()
    const today = startOfDay(now)
    const periodStart = subtractDays(today, days)
    const priorStart = subtractDays(periodStart, days)
    const yesterday = subtractDays(today, 1)

    // ── Total active users (not banned, not deleted) ─────────────────────────
    const [{ totalActive }] = await db
      .select({ totalActive: count() })
      .from(users)
      .where(and(eq(users.isBanned, false), isNull(users.deletedAt)))

    // ── DAU: distinct users with app_open event today ────────────────────────
    const dauResult = await db.execute(sql`
      SELECT COUNT(DISTINCT user_id)::int as cnt
      FROM activity_events
      WHERE event = 'app_open' AND created_at >= ${today}
    `)
    const dauToday = Number(rows(dauResult)[0]?.cnt || 0)

    // ── MAU: distinct users with app_open event in last 30 days ──────────────
    const mauStart = subtractDays(today, 30)
    const mauResult = await db.execute(sql`
      SELECT COUNT(DISTINCT user_id)::int as cnt
      FROM activity_events
      WHERE event = 'app_open' AND created_at >= ${mauStart}
    `)
    const mauCount = Number(rows(mauResult)[0]?.cnt || 0)

    // ── DAU in period vs prior period ────────────────────────────────────────
    const dauPeriodResult = await db.execute(sql`
      SELECT COUNT(DISTINCT user_id)::int as cnt
      FROM activity_events
      WHERE event = 'app_open' AND created_at >= ${periodStart}
    `)
    const dauPeriod = Number(rows(dauPeriodResult)[0]?.cnt || 0)

    const dauPriorResult = await db.execute(sql`
      SELECT COUNT(DISTINCT user_id)::int as cnt
      FROM activity_events
      WHERE event = 'app_open' AND created_at >= ${priorStart} AND created_at < ${periodStart}
    `)
    const dauPriorPeriod = Number(rows(dauPriorResult)[0]?.cnt || 0)

    // Fallback: if no activity data yet, use signup counts as proxy
    const hasActivityData = dauToday > 0 || dauPeriod > 0

    // ── New signups in current vs prior period (fallback + growth metric) ────
    const [{ currentPeriodUsers }] = await db
      .select({ currentPeriodUsers: count() })
      .from(users)
      .where(and(gte(users.createdAt, periodStart), isNull(users.deletedAt)))

    const [{ priorPeriodUsers }] = await db
      .select({ priorPeriodUsers: count() })
      .from(users)
      .where(and(gte(users.createdAt, priorStart), lte(users.createdAt, periodStart), isNull(users.deletedAt)))

    // ── Matches today + yesterday + period ───────────────────────────────────
    const [{ matchesToday }] = await db
      .select({ matchesToday: count() })
      .from(matches)
      .where(gte(matches.matchedAt, today))

    const [{ matchesYesterday }] = await db
      .select({ matchesYesterday: count() })
      .from(matches)
      .where(and(gte(matches.matchedAt, yesterday), lte(matches.matchedAt, today)))

    const [{ matchesPeriod }] = await db
      .select({ matchesPeriod: count() })
      .from(matches)
      .where(gte(matches.matchedAt, periodStart))

    // ── MRR: current active subscriptions ────────────────────────────────────
    const mrrResult = await db
      .select({ total: sql`COALESCE(SUM(${userSubscriptions.priceAtPurchase}::numeric), 0)` })
      .from(userSubscriptions)
      .where(eq(userSubscriptions.status, 'active'))
    const mrr = parseFloat(mrrResult[0]?.total || 0)

    // MRR prior: subscriptions that were active before this period (started before periodStart, not cancelled before periodStart)
    const mrrPriorResult = await db.execute(sql`
      SELECT COALESCE(SUM(price_at_purchase::numeric), 0) as total
      FROM user_subscriptions
      WHERE status IN ('active', 'expired', 'cancelled')
        AND started_at < ${periodStart}
        AND (cancelled_at IS NULL OR cancelled_at >= ${periodStart})
    `)
    const mrrPrior = parseFloat(rows(mrrPriorResult)[0]?.total || 0)

    // ── LTV: total revenue / total users who ever paid ───────────────────────
    const ltvResult = await db.execute(sql`
      SELECT
        COALESCE(SUM(price_at_purchase::numeric), 0) as total_rev,
        COUNT(DISTINCT user_id)::int as paying_users
      FROM user_subscriptions
      WHERE price_at_purchase IS NOT NULL AND price_at_purchase::numeric > 0
    `)
    const ltvRow = rows(ltvResult)[0]
    const totalRevSubs = parseFloat(ltvRow?.total_rev || 0)
    const payingUsers = Number(ltvRow?.paying_users || 0)

    const iapResult = await db.execute(sql`
      SELECT COALESCE(SUM(price_at_purchase::numeric), 0) as total_rev
      FROM in_app_purchases
    `)
    const totalRevIap = parseFloat(rows(iapResult)[0]?.total_rev || 0)
    const totalRevenue = totalRevSubs + totalRevIap
    const ltv = payingUsers > 0 ? totalRevenue / payingUsers : 0

    // LTV prior period comparison
    const ltvPriorResult = await db.execute(sql`
      SELECT
        COALESCE(SUM(price_at_purchase::numeric), 0) as total_rev,
        COUNT(DISTINCT user_id)::int as paying_users
      FROM user_subscriptions
      WHERE price_at_purchase IS NOT NULL AND price_at_purchase::numeric > 0
        AND started_at < ${periodStart}
    `)
    const ltvPriorRow = rows(ltvPriorResult)[0]
    const ltvPriorRev = parseFloat(ltvPriorRow?.total_rev || 0)
    const ltvPriorUsers = Number(ltvPriorRow?.paying_users || 0)
    const ltvPrior = ltvPriorUsers > 0 ? ltvPriorRev / ltvPriorUsers : 0
    const ltvDelta = ltv - ltvPrior

    // ── ARPU: revenue in period / active users ───────────────────────────────
    const arpuRevResult = await db.execute(sql`
      SELECT COALESCE(SUM(price_at_purchase::numeric), 0) as rev
      FROM user_subscriptions
      WHERE started_at >= ${periodStart}
        AND price_at_purchase IS NOT NULL
    `)
    const arpuIapResult = await db.execute(sql`
      SELECT COALESCE(SUM(price_at_purchase::numeric), 0) as rev
      FROM in_app_purchases
      WHERE purchased_at >= ${periodStart}
    `)
    const periodRev = parseFloat(rows(arpuRevResult)[0]?.rev || 0) + parseFloat(rows(arpuIapResult)[0]?.rev || 0)
    const arpu = totalActive > 0 ? periodRev / totalActive : 0

    // ARPU prior
    const arpuPriorRevResult = await db.execute(sql`
      SELECT COALESCE(SUM(price_at_purchase::numeric), 0) as rev
      FROM user_subscriptions
      WHERE started_at >= ${priorStart} AND started_at < ${periodStart}
        AND price_at_purchase IS NOT NULL
    `)
    const arpuPriorIapResult = await db.execute(sql`
      SELECT COALESCE(SUM(price_at_purchase::numeric), 0) as rev
      FROM in_app_purchases
      WHERE purchased_at >= ${priorStart} AND purchased_at < ${periodStart}
    `)
    const priorPeriodRev = parseFloat(rows(arpuPriorRevResult)[0]?.rev || 0) + parseFloat(rows(arpuPriorIapResult)[0]?.rev || 0)
    const arpuPrior = totalActive > 0 ? priorPeriodRev / totalActive : 0
    const arpuDelta = arpu - arpuPrior

    // ── Open reports ─────────────────────────────────────────────────────────
    const [{ openReports }] = await db
      .select({ openReports: count() })
      .from(reports)
      .where(eq(reports.status, 'pending'))

    const slaLimit = new Date(now.getTime() - 12 * 60 * 60 * 1000)
    const [{ slaBreaches }] = await db
      .select({ slaBreaches: count() })
      .from(reports)
      .where(and(eq(reports.status, 'pending'), lte(reports.createdAt, slaLimit)))

    const [{ bansToday }] = await db
      .select({ bansToday: count() })
      .from(userEnforcements)
      .where(and(inArray(userEnforcements.action, ['hard_ban', 'timed_pause']), gte(userEnforcements.createdAt, today)))

    const [{ appealsOpen }] = await db
      .select({ appealsOpen: count() })
      .from(appeals)
      .where(eq(appeals.status, 'open'))

    const [{ reportsYesterday }] = await db
      .select({ reportsYesterday: count() })
      .from(reports)
      .where(and(eq(reports.status, 'pending'), lte(reports.createdAt, yesterday)))

    // ── DAU Chart: daily active users series (or signup fallback) ───────────
    let currentSeries, priorSeries

    if (hasActivityData) {
      const dauCurrentChart = await db.execute(sql`
        SELECT DATE(created_at AT TIME ZONE 'UTC') as day, COUNT(DISTINCT user_id)::int as cnt
        FROM activity_events
        WHERE event = 'app_open' AND created_at >= ${periodStart}
        GROUP BY day ORDER BY day
      `)
      const dauPriorChart = await db.execute(sql`
        SELECT DATE(created_at AT TIME ZONE 'UTC') as day, COUNT(DISTINCT user_id)::int as cnt
        FROM activity_events
        WHERE event = 'app_open' AND created_at >= ${priorStart} AND created_at < ${periodStart}
        GROUP BY day ORDER BY day
      `)
      currentSeries = rows(dauCurrentChart).map(r => Number(r.cnt))
      priorSeries = rows(dauPriorChart).map(r => Number(r.cnt))
    } else {
      const dauCurrentChart = await db.execute(sql`
        SELECT DATE(created_at AT TIME ZONE 'UTC') as day, COUNT(*)::int as cnt
        FROM users
        WHERE created_at >= ${periodStart} AND deleted_at IS NULL
        GROUP BY day ORDER BY day
      `)
      const dauPriorChart = await db.execute(sql`
        SELECT DATE(created_at AT TIME ZONE 'UTC') as day, COUNT(*)::int as cnt
        FROM users
        WHERE created_at >= ${priorStart} AND created_at < ${periodStart} AND deleted_at IS NULL
        GROUP BY day ORDER BY day
      `)
      currentSeries = rows(dauCurrentChart).map(r => Number(r.cnt))
      priorSeries = rows(dauPriorChart).map(r => Number(r.cnt))
    }

    // ── Live users via Socket.io ─────────────────────────────────────────────
    let liveTotal = 0
    let livePlatforms = { ios: 0, android: 0, web: 0 }
    const io = getIO()
    if (io) {
      const sockets = await io.fetchSockets()
      liveTotal = sockets.length
    }

    const platformCounts = await db
      .select({ platform: userDevices.devicePlatform, cnt: count() })
      .from(userDevices)
      .groupBy(userDevices.devicePlatform)

    const totalDevices = platformCounts.reduce((s, r) => s + Number(r.cnt), 0) || 1
    for (const row of platformCounts) {
      const p = (row.platform || '').toLowerCase()
      if (p === 'ios') livePlatforms.ios = Math.round(liveTotal * Number(row.cnt) / totalDevices)
      else if (p === 'android') livePlatforms.android = Math.round(liveTotal * Number(row.cnt) / totalDevices)
      else livePlatforms.web = Math.round(liveTotal * Number(row.cnt) / totalDevices)
    }

    // ── Engagement funnel (real data from activity + likes + messages) ──────
    // App opens today (from activity_events)
    const appOpensResult = await db.execute(sql`
      SELECT COUNT(DISTINCT user_id)::int as cnt
      FROM activity_events
      WHERE event = 'app_open' AND created_at >= ${today}
    `)
    const appOpensToday = Number(rows(appOpensResult)[0]?.cnt || 0)

    // Unique users who swiped today
    const swipersResult = await db.execute(sql`
      SELECT COUNT(DISTINCT from_user_id)::int as cnt
      FROM likes
      WHERE created_at >= ${today}
    `)
    const swipersToday = Number(rows(swipersResult)[0]?.cnt || 0)

    // Unique users who got at least 1 match today
    const matchedUsersResult = await db.execute(sql`
      SELECT COUNT(DISTINCT u)::int as cnt FROM (
        SELECT user_a_id as u FROM matches WHERE matched_at >= ${today}
        UNION
        SELECT user_b_id as u FROM matches WHERE matched_at >= ${today}
      ) sub
    `)
    const matchedUsersToday = Number(rows(matchedUsersResult)[0]?.cnt || 0)

    // Unique users who sent at least 1 message today
    const msgSendersResult = await db.execute(sql`
      SELECT COUNT(DISTINCT sender_id)::int as cnt
      FROM messages
      WHERE created_at >= ${today} AND deleted_at IS NULL
    `)
    const msgSendersToday = Number(rows(msgSendersResult)[0]?.cnt || 0)

    // Matches where both users messaged today (got a reply)
    const repliedMatchesResult = await db.execute(sql`
      SELECT match_id FROM messages
      WHERE created_at >= ${today} AND deleted_at IS NULL
      GROUP BY match_id
      HAVING COUNT(DISTINCT sender_id) >= 2
    `)
    const repliedToday = rows(repliedMatchesResult).length

    // Use real app_open count or fallback to total users
    const funnelOpens = appOpensToday > 0 ? appOpensToday : totalActive
    const funnelBase = funnelOpens || 1
    const funnelData = [
      { label: 'App opens', v: funnelOpens, base: funnelBase },
      { label: 'Swipes started', v: swipersToday, base: funnelBase },
      { label: '≥1 match', v: matchedUsersToday, base: funnelBase },
      { label: 'Sent first msg', v: msgSendersToday, base: funnelBase },
      { label: 'Got a reply', v: repliedToday, base: funnelBase },
    ]

    // ── Geographic split ─────────────────────────────────────────────────────
    const geoRows = await db.execute(sql`
      SELECT country_code, COUNT(*)::int as cnt
      FROM users
      WHERE deleted_at IS NULL AND is_banned = false AND country_code IS NOT NULL
      GROUP BY country_code
      ORDER BY cnt DESC
      LIMIT 10
    `)
    const geoList = rows(geoRows).map(r => ({
      label: r.country_code,
      value: Number(r.cnt),
      pct: Number(((Number(r.cnt) / (totalActive || 1)) * 100).toFixed(1)),
    }))

    // ── Demographics: Age buckets ────────────────────────────────────────────
    const ageRows = await db.execute(sql`
      SELECT
        CASE
          WHEN age BETWEEN 18 AND 20 THEN '18-20'
          WHEN age BETWEEN 21 AND 24 THEN '21-24'
          WHEN age BETWEEN 25 AND 29 THEN '25-29'
          WHEN age BETWEEN 30 AND 34 THEN '30-34'
          WHEN age BETWEEN 35 AND 39 THEN '35-39'
          WHEN age BETWEEN 40 AND 44 THEN '40-44'
          ELSE '45+'
        END as bucket,
        COUNT(*)::int as cnt
      FROM users
      WHERE deleted_at IS NULL AND is_banned = false
      GROUP BY bucket
      ORDER BY bucket
    `)
    const ageTotal = rows(ageRows).reduce((s, r) => s + Number(r.cnt), 0) || 1
    const ageBuckets = rows(ageRows).map(r => ({
      label: r.bucket,
      pct: Number(((Number(r.cnt) / ageTotal) * 100).toFixed(1)),
      n: Number(r.cnt),
    }))

    // ── Demographics: Gender ─────────────────────────────────────────────────
    const genderRows = await db.execute(sql`
      SELECT iam, COUNT(*)::int as cnt
      FROM users
      WHERE deleted_at IS NULL AND is_banned = false
      GROUP BY iam
    `)
    const genderTotal = rows(genderRows).reduce((s, r) => s + Number(r.cnt), 0) || 1
    const genderMap = { woman: 'Women', man: 'Men', nonbinary: 'Non-binary', other: 'Other' }
    const genderColors = { woman: 'oklch(0.72 0.15 25)', man: 'oklch(0.70 0.14 235)', nonbinary: 'oklch(0.72 0.14 300)', other: 'oklch(0.72 0.10 80)' }
    const genderSplit = rows(genderRows).map(r => ({
      label: genderMap[r.iam] || r.iam,
      pct: Number(((Number(r.cnt) / genderTotal) * 100).toFixed(1)),
      n: Number(r.cnt),
      color: genderColors[r.iam] || 'oklch(0.72 0.10 80)',
    }))

    // ── Demographics: Orientation ────────────────────────────────────────────
    const orientationRows = await db.execute(sql`
      SELECT
        CASE
          WHEN orientation = '{}'::text[] OR orientation IS NULL THEN 'Not specified'
          WHEN array_length(orientation, 1) = 1 AND orientation[1] IN ('women', 'men') THEN 'Straight'
          ELSE 'Different'
        END as category,
        COUNT(*)::int as cnt
      FROM users
      WHERE deleted_at IS NULL AND is_banned = false
      GROUP BY category
    `)
    const oriTotal = rows(orientationRows).reduce((s, r) => s + Number(r.cnt), 0) || 1
    const orientationData = rows(orientationRows)
      .filter(r => r.category !== 'Not specified')
      .map(r => ({
        label: r.category,
        pct: Number(((Number(r.cnt) / oriTotal) * 100).toFixed(1)),
      }))

    // ── Demographics: Relationship intent ────────────────────────────────────
    const relIntentRows = await db.execute(sql`
      SELECT relationship_goal, COUNT(*)::int as cnt
      FROM users
      WHERE deleted_at IS NULL AND is_banned = false AND relationship_goal IS NOT NULL
      GROUP BY relationship_goal
      ORDER BY cnt DESC
    `)
    const relIntentTotal = rows(relIntentRows).reduce((s, r) => s + Number(r.cnt), 0) || 1
    const goalLabels = {
      casual: 'Casual', dating: 'Dating', serious: 'Long-term',
      non_monogamy: 'Non-monogamy', friends: 'Friends', figuring_out: 'Figuring it out',
    }
    const relIntent = rows(relIntentRows).map(r => ({
      label: goalLabels[r.relationship_goal] || r.relationship_goal,
      pct: Number(((Number(r.cnt) / relIntentTotal) * 100).toFixed(1)),
    }))

    // ── Demographics: Relationship status ────────────────────────────────────
    const relStatusRows = await db.execute(sql`
      SELECT rel_status, COUNT(*)::int as cnt
      FROM users
      WHERE deleted_at IS NULL AND is_banned = false AND rel_status IS NOT NULL
      GROUP BY rel_status
      ORDER BY cnt DESC
    `)
    const relStatusTotal = rows(relStatusRows).reduce((s, r) => s + Number(r.cnt), 0) || 1
    const statusLabels = {
      single: 'Single', in_relationship: 'In a relationship', married: 'Married',
      non_monogamous: 'Non-monogamous', complicated: "It's complicated", prefer_not_say: 'Prefer not to say',
    }
    const relStatus = rows(relStatusRows).map(r => ({
      label: statusLabels[r.rel_status] || r.rel_status,
      pct: Number(((Number(r.cnt) / relStatusTotal) * 100).toFixed(1)),
      n: Number(r.cnt),
    }))

    // ── Demographics: Cities ─────────────────────────────────────────────────
    const cityRows = await db.execute(sql`
      SELECT city, COUNT(*)::int as cnt
      FROM users
      WHERE deleted_at IS NULL AND is_banned = false AND city IS NOT NULL
      GROUP BY city
      ORDER BY cnt DESC
      LIMIT 100
    `)
    const cities = rows(cityRows).map(r => ({
      label: r.city,
      n: Number(r.cnt),
      pct: Number(((Number(r.cnt) / (totalActive || 1)) * 100).toFixed(1)),
    }))

    // ── Sparkline series (last 12 days) ──────────────────────────────────────
    const sparkDays = 12
    const sparkStart = subtractDays(today, sparkDays)

    const sparkUsers = await db.execute(sql`
      SELECT DATE(created_at AT TIME ZONE 'UTC') as day, COUNT(*)::int as cnt
      FROM users WHERE created_at >= ${sparkStart} AND deleted_at IS NULL
      GROUP BY day ORDER BY day
    `)
    const sparkMatches = await db.execute(sql`
      SELECT DATE(matched_at AT TIME ZONE 'UTC') as day, COUNT(*)::int as cnt
      FROM matches WHERE matched_at >= ${sparkStart}
      GROUP BY day ORDER BY day
    `)
    const sparkSubs = await db.execute(sql`
      SELECT DATE(started_at AT TIME ZONE 'UTC') as day, COALESCE(SUM(price_at_purchase::numeric), 0)::float as total
      FROM user_subscriptions
      WHERE started_at >= ${sparkStart} AND status = 'active'
      GROUP BY day ORDER BY day
    `)

    const userSpark = rows(sparkUsers).map(r => Number(r.cnt))
    const matchSpark = rows(sparkMatches).map(r => Number(r.cnt))
    const subSpark = rows(sparkSubs).map(r => Number(r.total))

    // ── Build response ───────────────────────────────────────────────────────
    const dauDisplay = hasActivityData ? dauToday : totalActive
    const mauDisplay = hasActivityData ? mauCount : totalActive
    const dauDelta = hasActivityData
      ? formatDelta(dauPeriod, dauPriorPeriod)
      : formatDelta(currentPeriodUsers, priorPeriodUsers)

    const response = {
      kpis: {
        dau: {
          v: formatNum(dauDisplay),
          d: dauDelta,
          t: `vs last ${range}`,
          series: pad(userSpark, sparkDays),
        },
        mau: {
          v: formatNum(mauDisplay),
          d: dauDelta,
          t: 'rolling 30d',
          series: pad(userSpark, sparkDays),
        },
        matchesToday: {
          v: formatNum(Number(matchesToday)),
          d: formatDelta(Number(matchesToday), Number(matchesYesterday)),
          t: 'vs yesterday',
          series: pad(matchSpark, sparkDays),
        },
        mrr: {
          v: `$${mrr >= 1000000 ? (mrr / 1000000).toFixed(2) + 'M' : mrr >= 1000 ? (mrr / 1000).toFixed(1) + 'k' : mrr.toFixed(0)}`,
          d: formatDelta(mrr, mrrPrior),
          t: 'vs prior period',
          series: pad(subSpark, sparkDays),
        },
        ltv: {
          v: `$${ltv.toFixed(2)}`,
          d: `${ltvDelta >= 0 ? '+' : ''}$${ltvDelta.toFixed(2)}`,
          t: `last ${range}`,
        },
        arpu: {
          v: `$${arpu.toFixed(2)}`,
          d: `${arpuDelta >= 0 ? '+' : ''}$${arpuDelta.toFixed(2)}`,
          t: `vs prev ${range}`,
        },
        openReports: {
          v: formatNum(Number(openReports)),
          d: `+${Math.max(0, Number(openReports) - Number(reportsYesterday))}`,
          t: 'since yesterday',
        },
        slaBreaches: {
          v: formatNum(Number(slaBreaches)),
          d: '+0',
          t: '>12h open',
        },
        bansToday: {
          v: formatNum(Number(bansToday)),
          d: '+0',
          t: 'hard ban + pause',
        },
        appealsOpen: {
          v: formatNum(Number(appealsOpen)),
          d: '+0',
          t: 'open appeals',
        },
      },
      dauChart: {
        current: currentSeries.length > 0 ? currentSeries : pad(userSpark, days),
        prior: priorSeries.length > 0 ? priorSeries : pad([], days),
        labels: buildLabels(range, days),
      },
      liveUsers: {
        total: liveTotal,
        platforms: livePlatforms,
      },
      funnel: funnelData,
      geo: geoList,
      demographics: {
        ageBuckets,
        genderSplit,
        orientation: orientationData,
        relIntent,
        relStatus,
        cities,
      },
    }

    return res.json(response)
  } catch (err) {
    console.error('Overview API error:', err)
    return res.status(500).json({ error: 'Failed to load overview data' })
  }
}
