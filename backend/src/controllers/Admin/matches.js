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

function formatNum(n) {
  return n.toLocaleString('en-US')
}

function rows(result) {
  return result.rows || result || []
}

function pad(arr, len) {
  const copy = [...arr]
  while (copy.length < len) copy.unshift(0)
  return copy.slice(-len)
}

export async function getMatches(req, res) {
  try {
    const range = req.query.range || '30d'
    const days = range === '24h' ? 1 : range === '7d' ? 7 : range === '30d' ? 30 : range === '90d' ? 90 : 30

    const now = new Date()
    const today = startOfDay(now)
    const periodStart = subtractDays(today, days)
    const priorStart = subtractDays(periodStart, days)

    // ── KPI: Matches per day ─────────────────────────────────────────────────
    const [{ matchesPeriod }] = rows(await db.execute(sql`
      SELECT COUNT(*)::int as "matchesPeriod"
      FROM matches WHERE matched_at >= ${periodStart}
    `))
    const [{ matchesPrior }] = rows(await db.execute(sql`
      SELECT COUNT(*)::int as "matchesPrior"
      FROM matches WHERE matched_at >= ${priorStart} AND matched_at < ${periodStart}
    `))

    const matchesPerDay = days > 0 ? Math.round(Number(matchesPeriod) / days) : 0
    const matchesPerDayPrior = days > 0 ? Math.round(Number(matchesPrior) / days) : 0
    const matchesDelta = matchesPerDayPrior > 0
      ? `+${(((matchesPerDay - matchesPerDayPrior) / matchesPerDayPrior) * 100).toFixed(1)}%`
      : '+0.0%'

    // ── KPI: Reply rate (matches where both users sent ≥1 message) ───────────
    const [{ totalMatchesPeriod }] = rows(await db.execute(sql`
      SELECT COUNT(*)::int as "totalMatchesPeriod"
      FROM matches WHERE matched_at >= ${periodStart}
    `))
    const [{ repliedMatches }] = rows(await db.execute(sql`
      SELECT COUNT(*)::int as "repliedMatches"
      FROM matches
      WHERE matched_at >= ${periodStart}
        AND message_count_user_a > 0
        AND message_count_user_b > 0
    `))

    const replyRate = Number(totalMatchesPeriod) > 0
      ? ((Number(repliedMatches) / Number(totalMatchesPeriod)) * 100).toFixed(1)
      : '0.0'

    // Prior period reply rate
    const [{ totalMatchesPrior }] = rows(await db.execute(sql`
      SELECT COUNT(*)::int as "totalMatchesPrior"
      FROM matches WHERE matched_at >= ${priorStart} AND matched_at < ${periodStart}
    `))
    const [{ repliedMatchesPrior }] = rows(await db.execute(sql`
      SELECT COUNT(*)::int as "repliedMatchesPrior"
      FROM matches
      WHERE matched_at >= ${priorStart} AND matched_at < ${periodStart}
        AND message_count_user_a > 0
        AND message_count_user_b > 0
    `))
    const replyRatePrior = Number(totalMatchesPrior) > 0
      ? ((Number(repliedMatchesPrior) / Number(totalMatchesPrior)) * 100)
      : 0
    const replyDelta = (parseFloat(replyRate) - replyRatePrior).toFixed(1)

    // ── KPI: Messages per match (average) ────────────────────────────────────
    const [{ avgMsgs }] = rows(await db.execute(sql`
      SELECT COALESCE(AVG(message_count_user_a + message_count_user_b), 0)::float as "avgMsgs"
      FROM matches
      WHERE matched_at >= ${periodStart}
        AND (message_count_user_a + message_count_user_b) > 0
    `))
    const [{ avgMsgsPrior }] = rows(await db.execute(sql`
      SELECT COALESCE(AVG(message_count_user_a + message_count_user_b), 0)::float as "avgMsgsPrior"
      FROM matches
      WHERE matched_at >= ${priorStart} AND matched_at < ${periodStart}
        AND (message_count_user_a + message_count_user_b) > 0
    `))
    const msgsDelta = (Number(avgMsgs) - Number(avgMsgsPrior)).toFixed(1)

    // ── KPI: Off-platform estimate (unmatched after ≥5 messages = likely moved off) ──
    const [{ offPlatformCount }] = rows(await db.execute(sql`
      SELECT COUNT(*)::int as "offPlatformCount"
      FROM matches
      WHERE matched_at >= ${periodStart}
        AND is_active = false
        AND (message_count_user_a + message_count_user_b) >= 5
    `))
    const offPlatformPct = Number(totalMatchesPeriod) > 0
      ? ((Number(offPlatformCount) / Number(totalMatchesPeriod)) * 100).toFixed(1)
      : '0.0'

    // ── Chart: Daily matches and messages ────────────────────────────────────
    const matchChart = await db.execute(sql`
      SELECT DATE(matched_at AT TIME ZONE 'UTC') as day, COUNT(*)::int as cnt
      FROM matches WHERE matched_at >= ${periodStart}
      GROUP BY day ORDER BY day
    `)
    const msgChart = await db.execute(sql`
      SELECT DATE(created_at AT TIME ZONE 'UTC') as day, COUNT(*)::int as cnt
      FROM messages WHERE created_at >= ${periodStart} AND deleted_at IS NULL
      GROUP BY day ORDER BY day
    `)

    const matchSeries = rows(matchChart).map(r => Number(r.cnt))
    const msgSeries = rows(msgChart).map(r => Number(r.cnt))

    const labels = days <= 7
      ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
      : days <= 30
        ? ['Wk1', 'Wk2', 'Wk3', 'Wk4']
        : ['M1', 'M2', 'M3']

    // ── Quality distribution (based on message engagement depth) ─────────────
    const qualityRows = await db.execute(sql`
      SELECT
        CASE
          WHEN (message_count_user_a + message_count_user_b) >= 20 THEN 'excellent'
          WHEN (message_count_user_a + message_count_user_b) >= 10 THEN 'good'
          WHEN (message_count_user_a + message_count_user_b) >= 3 THEN 'fair'
          ELSE 'low'
        END as quality,
        COUNT(*)::int as cnt
      FROM matches
      WHERE matched_at >= ${periodStart}
      GROUP BY quality
    `)

    const qualityMap = { excellent: 0, good: 0, fair: 0, low: 0 }
    for (const r of rows(qualityRows)) {
      qualityMap[r.quality] = Number(r.cnt)
    }
    const qualityTotal = Object.values(qualityMap).reduce((s, v) => s + v, 0) || 1

    // ── Cohort breakdown: match rate by age bucket + gender ───────────────────
    const cohortRows = await db.execute(sql`
      SELECT
        CASE
          WHEN u.age BETWEEN 18 AND 24 THEN '18-24'
          WHEN u.age BETWEEN 25 AND 29 THEN '25-29'
          WHEN u.age BETWEEN 30 AND 34 THEN '30-34'
          WHEN u.age BETWEEN 35 AND 44 THEN '35-44'
          ELSE '45+'
        END as age_bucket,
        u.iam,
        COUNT(*)::int as cnt
      FROM matches m
      JOIN users u ON u.id = m.user_a_id OR u.id = m.user_b_id
      WHERE m.matched_at >= ${periodStart}
        AND u.deleted_at IS NULL
      GROUP BY age_bucket, u.iam
      ORDER BY age_bucket
    `)

    const cohortMap = {}
    for (const r of rows(cohortRows)) {
      if (!cohortMap[r.age_bucket]) cohortMap[r.age_bucket] = { age: r.age_bucket, m: 0, f: 0, total: 0 }
      if (r.iam === 'man') cohortMap[r.age_bucket].m += Number(r.cnt)
      else if (r.iam === 'woman') cohortMap[r.age_bucket].f += Number(r.cnt)
      cohortMap[r.age_bucket].total += Number(r.cnt)
    }
    const cohortTotal = Object.values(cohortMap).reduce((s, v) => s + v.total, 0) || 1
    const cohort = Object.values(cohortMap).map(c => ({
      age: c.age,
      m: cohortTotal > 0 ? Math.round((c.m / cohortTotal) * 100) : 0,
      f: cohortTotal > 0 ? Math.round((c.f / cohortTotal) * 100) : 0,
      pct: cohortTotal > 0 ? Math.round((c.total / cohortTotal) * 100) : 0,
    }))

    // ── Conversation outcomes ────────────────────────────────────────────────
    const totalMatchesNum = Number(totalMatchesPeriod) || 1

    // Any message sent
    const [{ anyMsg }] = rows(await db.execute(sql`
      SELECT COUNT(*)::int as "anyMsg"
      FROM matches
      WHERE matched_at >= ${periodStart}
        AND (message_count_user_a + message_count_user_b) >= 1
    `))

    // ≥3 back-and-forth (both users sent, total ≥ 6)
    const [{ threeBackForth }] = rows(await db.execute(sql`
      SELECT COUNT(*)::int as "threeBackForth"
      FROM matches
      WHERE matched_at >= ${periodStart}
        AND message_count_user_a >= 3
        AND message_count_user_b >= 3
    `))

    // Deep conversations (≥10 total messages, proxy for phone/social shared)
    const [{ deepConvos }] = rows(await db.execute(sql`
      SELECT COUNT(*)::int as "deepConvos"
      FROM matches
      WHERE matched_at >= ${periodStart}
        AND (message_count_user_a + message_count_user_b) >= 10
    `))

    // Unmatched (reported or unmatched)
    const [{ unmatchedCount }] = rows(await db.execute(sql`
      SELECT COUNT(*)::int as "unmatchedCount"
      FROM matches
      WHERE matched_at >= ${periodStart}
        AND is_active = false
        AND unmatched_at IS NOT NULL
    `))

    const outcomes = [
      { label: 'Any message sent', v: Number(anyMsg), base: totalMatchesNum },
      { label: '≥3 back-and-forth', v: Number(threeBackForth), base: totalMatchesNum },
      { label: 'Deep conversation (10+ msgs)', v: Number(deepConvos), base: totalMatchesNum },
      { label: 'Moved off-platform (est.)', v: Number(offPlatformCount), base: totalMatchesNum },
      { label: 'Reported / unmatched', v: Number(unmatchedCount), base: totalMatchesNum },
    ]

    // ── Sparkline series (last 14 points) ────────────────────────────────────
    const sparkLen = 14
    const sparkStart = subtractDays(today, sparkLen)
    const sparkMatchesResult = await db.execute(sql`
      SELECT DATE(matched_at AT TIME ZONE 'UTC') as day, COUNT(*)::int as cnt
      FROM matches WHERE matched_at >= ${sparkStart}
      GROUP BY day ORDER BY day
    `)
    const sparkMatches = rows(sparkMatchesResult).map(r => Number(r.cnt))

    const response = {
      kpis: {
        matchesPerDay: {
          v: formatNum(matchesPerDay),
          d: matchesDelta,
          t: `vs prior ${range}`,
          series: pad(sparkMatches, sparkLen),
        },
        replyRate: {
          v: `${replyRate}%`,
          d: `${parseFloat(replyDelta) >= 0 ? '+' : ''}${replyDelta}pp`,
          t: `vs prior ${range}`,
          series: [],
        },
        msgsPerMatch: {
          v: Number(avgMsgs).toFixed(1),
          d: `${parseFloat(msgsDelta) >= 0 ? '+' : ''}${msgsDelta}`,
          t: 'avg',
          series: [],
        },
        offPlatform: {
          v: `${offPlatformPct}%`,
          d: '',
          t: 'est. from deep convos',
          series: [],
        },
      },
      chart: {
        matches: matchSeries,
        messages: msgSeries,
        labels,
      },
      quality: {
        excellent: Math.round((qualityMap.excellent / qualityTotal) * 100),
        good: Math.round((qualityMap.good / qualityTotal) * 100),
        fair: Math.round((qualityMap.fair / qualityTotal) * 100),
        low: Math.round((qualityMap.low / qualityTotal) * 100),
      },
      cohort,
      outcomes,
    }

    return res.json(response)
  } catch (err) {
    console.error('Matches API error:', err)
    return res.status(500).json({ error: 'Failed to load matches data' })
  }
}
