import { sql } from 'drizzle-orm'
import { db } from '../../../db/index.js'

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
