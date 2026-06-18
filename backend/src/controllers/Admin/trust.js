import { sql } from 'drizzle-orm'
import { db } from '../../../db/index.js'

const STATUS_TO_DB = {
  new: 'pending',
  review: 'reviewed',
  resolved: 'actioned',
}

const DB_TO_UI_STATUS = {
  pending: 'new',
  reviewed: 'review',
  actioned: 'resolved',
  dismissed: 'resolved',
}

const REASON_META = {
  fake: { label: 'Impersonation', severity: 'medium' },
  inappropriate: { label: 'Nudity in photos', severity: 'high' },
  harassment: { label: 'Harassment', severity: 'high' },
  minor: { label: 'Minor suspected', severity: 'critical' },
  spam: { label: 'Spam / off-platform', severity: 'medium' },
  safety: { label: 'Safety concern', severity: 'high' },
  other: { label: 'Other', severity: 'low' },
}

const ALLOWED_DB_STATUSES = new Set(['pending', 'reviewed', 'actioned', 'dismissed'])
const ENFORCEMENT_ACTIONS = new Set(['hard_ban', 'timed_pause'])
const APPEAL_DECISIONS = new Set(['uphold', 'overturn'])

function rows(result) {
  return result.rows || result || []
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function normalizeSearch(value) {
  return String(value || '').trim()
}

export function mapDbStatusToUi(status) {
  return DB_TO_UI_STATUS[status] || 'new'
}

export function mapUiStatusToDb(status) {
  const normalized = String(status || '').trim().toLowerCase()
  if (STATUS_TO_DB[normalized]) return STATUS_TO_DB[normalized]
  if (ALLOWED_DB_STATUSES.has(normalized)) return normalized
  return null
}

export function getReasonMeta(reason) {
  return REASON_META[reason] || { label: reason || 'Other', severity: 'low' }
}

export function formatRelative(date) {
  if (!date) return '—'
  const then = new Date(date).getTime()
  if (!Number.isFinite(then)) return '—'
  const diffMs = Date.now() - then
  const mins = Math.max(0, Math.floor(diffMs / 60000))
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d`
  return `${Math.floor(days / 30)}mo`
}

function normalizeListFilters(query) {
  const page = clamp(parseInt(query.page, 10) || 1, 1, 9999)
  const limit = clamp(parseInt(query.limit, 10) || 20, 5, 100)
  const q = normalizeSearch(query.q)
  const reason = normalizeSearch(query.reason).toLowerCase() || null
  const statusFilter = normalizeSearch(query.status).toLowerCase() || 'all'

  const mappedDbStatus = mapUiStatusToDb(statusFilter)
  const status = statusFilter === 'all' ? 'all' : mappedDbStatus

  return { page, limit, offset: (page - 1) * limit, q, reason, status }
}

function serializeReport(row) {
  const reasonMeta = getReasonMeta(row.reason)
  return {
    id: row.id,
    reason: reasonMeta.label,
    reasonCode: row.reason,
    severity: reasonMeta.severity,
    reporterId: row.reporter_id,
    reporterName: row.reporter_name || 'Unknown',
    subjectId: row.subject_id,
    subjectName: row.subject_name || 'Unknown',
    details: row.details || '',
    status: mapDbStatusToUi(row.status),
    statusCode: row.status,
    age: formatRelative(row.created_at),
    createdAt: row.created_at,
    reviewedAt: row.reviewed_at,
    resolutionNote: row.resolution_note || '',
    enforcementId: row.enforcement_id || null,
    aiScore: null,
    evidenceCount: null,
  }
}

export async function listReports(req, res) {
  try {
    const { page, limit, offset, q, reason, status } = normalizeListFilters(req.query)

    if (status === null) {
      return res.status(400).json({ error: 'Invalid status filter' })
    }

    const where = [sql`1=1`]
    if (status && status !== 'all') {
      where.push(sql`r.status = ${status}`)
    }
    if (reason) {
      where.push(sql`r.reason = ${reason}`)
    }
    if (q) {
      const like = `%${q}%`
      where.push(sql`(
        r.id::text ILIKE ${like}
        OR reporter.handle ILIKE ${like}
        OR subject.handle ILIKE ${like}
        OR r.reported_id::text ILIKE ${like}
        OR r.reporter_id::text ILIKE ${like}
      )`)
    }
    const whereSql = sql.join(where, sql` AND `)

    const countResult = await db.execute(sql`
      SELECT COUNT(*)::int AS total
      FROM reports r
      LEFT JOIN users reporter ON reporter.id = r.reporter_id
      LEFT JOIN users subject ON subject.id = r.reported_id
      WHERE ${whereSql}
    `)
    const total = Number(rows(countResult)[0]?.total || 0)

    const listResult = await db.execute(sql`
      SELECT
        r.id,
        r.reason,
        r.details,
        r.status,
        r.reporter_id,
        r.reported_id AS subject_id,
        r.created_at,
        r.reviewed_at,
        r.resolution_note,
        r.enforcement_id,
        reporter.handle AS reporter_name,
        subject.handle AS subject_name
      FROM reports r
      LEFT JOIN users reporter ON reporter.id = r.reporter_id
      LEFT JOIN users subject ON subject.id = r.reported_id
      WHERE ${whereSql}
      ORDER BY r.created_at DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `)

    const items = rows(listResult).map(serializeReport)

    const summaryResult = await db.execute(sql`
      SELECT
        COUNT(*) FILTER (WHERE status = 'pending')::int AS open_reports,
        COUNT(*) FILTER (WHERE status = 'reviewed')::int AS under_review,
        COUNT(*) FILTER (WHERE status IN ('actioned', 'dismissed'))::int AS resolved_reports,
        COUNT(*) FILTER (WHERE status = 'pending' AND reason = 'minor')::int AS critical_open
      FROM reports
    `)
    const summaryRow = rows(summaryResult)[0] || {}
    const summary = {
      openReports: Number(summaryRow.open_reports || 0),
      criticalOpen: Number(summaryRow.critical_open || 0),
      byStatus: {
        new: Number(summaryRow.open_reports || 0),
        review: Number(summaryRow.under_review || 0),
        resolved: Number(summaryRow.resolved_reports || 0),
      },
    }

    return res.json({
      reports: items,
      summary,
      pagination: {
        page,
        limit,
        total,
        pages: Math.max(1, Math.ceil(total / limit)),
      },
    })
  } catch (err) {
    console.error('Trust reports list error:', err)
    return res.status(500).json({ error: 'Failed to load reports' })
  }
}

export async function getReportDetail(req, res) {
  try {
    const { reportId } = req.params
    const detailResult = await db.execute(sql`
      SELECT
        r.id,
        r.reason,
        r.details,
        r.status,
        r.reporter_id,
        r.reported_id AS subject_id,
        r.created_at,
        r.reviewed_at,
        r.resolution_note,
        r.enforcement_id,
        reporter.handle AS reporter_name,
        subject.handle AS subject_name
      FROM reports r
      LEFT JOIN users reporter ON reporter.id = r.reporter_id
      LEFT JOIN users subject ON subject.id = r.reported_id
      WHERE r.id = ${reportId}
      LIMIT 1
    `)

    const row = rows(detailResult)[0]
    if (!row) return res.status(404).json({ error: 'Report not found' })

    return res.json({ report: serializeReport(row) })
  } catch (err) {
    console.error('Trust report detail error:', err)
    return res.status(500).json({ error: 'Failed to load report detail' })
  }
}

export async function updateReport(req, res) {
  try {
    const { reportId } = req.params
    const nextStatus = mapUiStatusToDb(req.body?.status)
    const resolutionNote = String(req.body?.resolutionNote || '').trim()

    if (!nextStatus) {
      return res.status(400).json({ error: 'Invalid status' })
    }
    if (resolutionNote.length > 1000) {
      return res.status(400).json({ error: 'Resolution note is too long' })
    }

    const now = new Date()
    const reviewedByAdminId = nextStatus === 'pending' ? null : req.admin?.id || null
    const reviewedAt = nextStatus === 'pending' ? null : now

    const updateResult = await db.execute(sql`
      UPDATE reports
      SET
        status = ${nextStatus},
        reviewed_by_admin_id = ${reviewedByAdminId},
        reviewed_at = ${reviewedAt},
        resolution_note = ${resolutionNote || null},
        updated_at = ${now}
      WHERE id = ${reportId}
      RETURNING id
    `)

    if (!rows(updateResult)[0]) {
      return res.status(404).json({ error: 'Report not found' })
    }

    return res.json({
      ok: true,
      reportId,
      status: mapDbStatusToUi(nextStatus),
      statusCode: nextStatus,
      reviewedAt,
      resolutionNote: resolutionNote || '',
    })
  } catch (err) {
    console.error('Trust report update error:', err)
    return res.status(500).json({ error: 'Failed to update report' })
  }
}

export async function enforceReport(req, res) {
  try {
    const { reportId } = req.params
    const action = String(req.body?.action || '').trim().toLowerCase()
    const reason = String(req.body?.reason || '').trim()
    const note = String(req.body?.note || '').trim()
    const durationHours = Number(req.body?.durationHours || 0)

    if (!ENFORCEMENT_ACTIONS.has(action)) {
      return res.status(400).json({ error: 'Invalid action' })
    }
    if (!reason) return res.status(400).json({ error: 'reason required' })

    let endsAt = null
    if (action === 'timed_pause') {
      if (!Number.isFinite(durationHours) || durationHours < 1 || durationHours > 24 * 90) {
        return res.status(400).json({ error: 'durationHours must be between 1 and 2160' })
      }
      endsAt = new Date(Date.now() + durationHours * 60 * 60 * 1000)
    }

    const reportResult = await db.execute(sql`
      SELECT id, reported_id, status FROM reports
      WHERE id = ${reportId}
      LIMIT 1
    `)
    const reportRow = rows(reportResult)[0]
    if (!reportRow) return res.status(404).json({ error: 'Report not found' })

    const now = new Date()
    let enforcementId = null
    await db.transaction(async (tx) => {
      await tx.execute(sql`
        UPDATE user_enforcements
        SET active = false, updated_at = ${now}
        WHERE user_id = ${reportRow.reported_id} AND active = true
      `)

      const enforcementResult = await tx.execute(sql`
        INSERT INTO user_enforcements (
          user_id, report_id, action, reason, note, active, starts_at, ends_at, created_by_admin_id, created_at, updated_at
        ) VALUES (
          ${reportRow.reported_id}, ${reportId}, ${action}, ${reason}, ${note || null}, true, ${now}, ${endsAt}, ${req.admin?.id || null}, ${now}, ${now}
        )
        RETURNING id
      `)
      enforcementId = rows(enforcementResult)[0]?.id || null

      await tx.execute(sql`
        UPDATE users
        SET
          is_banned = ${action === 'hard_ban'},
          banned_by_admin_id = ${action === 'hard_ban' ? req.admin?.id || null : null},
          ban_reason = ${action === 'hard_ban' ? reason : null},
          is_paused = ${action === 'timed_pause'},
          paused_until = ${action === 'timed_pause' ? endsAt : null},
          updated_at = ${now}
        WHERE id = ${reportRow.reported_id}
      `)

      await tx.execute(sql`
        UPDATE reports
        SET
          status = 'actioned',
          reviewed_by_admin_id = ${req.admin?.id || null},
          reviewed_at = ${now},
          resolution_note = ${note || reason},
          enforcement_id = ${enforcementId},
          updated_at = ${now}
        WHERE id = ${reportId}
      `)
    })

    return res.json({
      ok: true,
      reportId,
      userId: reportRow.reported_id,
      enforcementId,
      action,
      endsAt,
    })
  } catch (err) {
    console.error('Trust enforce report error:', err)
    return res.status(500).json({ error: 'Failed to enforce report action' })
  }
}

export async function unbanUser(req, res) {
  try {
    const { userId } = req.params
    const note = String(req.body?.note || '').trim()
    const now = new Date()

    await db.transaction(async (tx) => {
      await tx.execute(sql`
        UPDATE user_enforcements
        SET active = false, updated_at = ${now}
        WHERE user_id = ${userId} AND active = true
      `)

      await tx.execute(sql`
        INSERT INTO user_enforcements (
          user_id, action, reason, note, active, starts_at, ends_at, created_by_admin_id, created_at, updated_at
        ) VALUES (
          ${userId}, 'unban', ${note || 'Admin unban'}, ${note || null}, false, ${now}, ${now}, ${req.admin?.id || null}, ${now}, ${now}
        )
      `)

      await tx.execute(sql`
        UPDATE users
        SET
          is_banned = false,
          banned_by_admin_id = null,
          ban_reason = null,
          is_paused = false,
          paused_until = null,
          updated_at = ${now}
        WHERE id = ${userId}
      `)
    })

    return res.json({ ok: true, userId, unbannedAt: now })
  } catch (err) {
    console.error('Trust unban user error:', err)
    return res.status(500).json({ error: 'Failed to unban user' })
  }
}

function serializeAppeal(row) {
  return {
    id: row.id,
    enforcementId: row.enforcement_id,
    userId: row.user_id,
    userName: row.user_name || 'Unknown',
    status: row.status,
    decision: row.decision,
    statement: row.statement,
    decisionNote: row.decision_note || '',
    createdAt: row.created_at,
    decidedAt: row.decided_at,
    decidedByAdminId: row.decided_by_admin_id,
    enforcementAction: row.enforcement_action,
    enforcementReason: row.enforcement_reason,
  }
}

export async function listAppeals(req, res) {
  try {
    const status = String(req.query.status || 'all').trim().toLowerCase()
    const where = [sql`1=1`]
    if (status !== 'all') where.push(sql`a.status = ${status}`)
    const whereSql = sql.join(where, sql` AND `)

    const result = await db.execute(sql`
      SELECT
        a.id,
        a.enforcement_id,
        a.user_id,
        a.statement,
        a.status,
        a.decision,
        a.decision_note,
        a.decided_by_admin_id,
        a.created_at,
        a.decided_at,
        u.handle AS user_name,
        e.action AS enforcement_action,
        e.reason AS enforcement_reason
      FROM appeals a
      LEFT JOIN users u ON u.id = a.user_id
      LEFT JOIN user_enforcements e ON e.id = a.enforcement_id
      WHERE ${whereSql}
      ORDER BY a.created_at DESC
    `)

    const appeals = rows(result).map(serializeAppeal)
    return res.json({
      appeals,
      summary: {
        open: appeals.filter((item) => item.status === 'open').length,
        decided: appeals.filter((item) => item.status === 'decided').length,
      },
    })
  } catch (err) {
    console.error('Trust appeals list error:', err)
    return res.status(500).json({ error: 'Failed to load appeals' })
  }
}

export async function getAppealDetail(req, res) {
  try {
    const { appealId } = req.params
    const result = await db.execute(sql`
      SELECT
        a.id,
        a.enforcement_id,
        a.user_id,
        a.statement,
        a.status,
        a.decision,
        a.decision_note,
        a.decided_by_admin_id,
        a.created_at,
        a.decided_at,
        u.handle AS user_name,
        e.action AS enforcement_action,
        e.reason AS enforcement_reason,
        e.note AS enforcement_note,
        e.active AS enforcement_active
      FROM appeals a
      LEFT JOIN users u ON u.id = a.user_id
      LEFT JOIN user_enforcements e ON e.id = a.enforcement_id
      WHERE a.id = ${appealId}
      LIMIT 1
    `)
    const row = rows(result)[0]
    if (!row) return res.status(404).json({ error: 'Appeal not found' })
    return res.json({ appeal: serializeAppeal(row) })
  } catch (err) {
    console.error('Trust appeal detail error:', err)
    return res.status(500).json({ error: 'Failed to load appeal' })
  }
}

export async function decideAppeal(req, res) {
  try {
    const { appealId } = req.params
    const decision = String(req.body?.decision || '').trim().toLowerCase()
    const note = String(req.body?.note || '').trim()
    if (!APPEAL_DECISIONS.has(decision)) {
      return res.status(400).json({ error: 'Invalid decision' })
    }
    if (!note) return res.status(400).json({ error: 'note required' })

    const lookup = await db.execute(sql`
      SELECT a.id, a.enforcement_id, a.user_id, e.action, e.active
      FROM appeals a
      LEFT JOIN user_enforcements e ON e.id = a.enforcement_id
      WHERE a.id = ${appealId}
      LIMIT 1
    `)
    const row = rows(lookup)[0]
    if (!row) return res.status(404).json({ error: 'Appeal not found' })
    if (String(row.id).length === 0) return res.status(404).json({ error: 'Appeal not found' })

    const now = new Date()
    await db.transaction(async (tx) => {
      await tx.execute(sql`
        UPDATE appeals
        SET
          status = 'decided',
          decision = ${decision},
          decision_note = ${note},
          decided_by_admin_id = ${req.admin?.id || null},
          decided_at = ${now},
          updated_at = ${now}
        WHERE id = ${appealId}
      `)

      if (decision === 'overturn') {
        await tx.execute(sql`
          UPDATE user_enforcements
          SET active = false, updated_at = ${now}
          WHERE id = ${row.enforcement_id}
        `)
        await tx.execute(sql`
          UPDATE users
          SET
            is_banned = false,
            banned_by_admin_id = null,
            ban_reason = null,
            is_paused = false,
            paused_until = null,
            updated_at = ${now}
          WHERE id = ${row.user_id}
        `)
      }
    })

    return res.json({ ok: true, appealId, decision, decidedAt: now })
  } catch (err) {
    console.error('Trust appeal decision error:', err)
    return res.status(500).json({ error: 'Failed to decide appeal' })
  }
}

export async function listBans(req, res) {
  try {
    const activeOnly = String(req.query.activeOnly || 'true').trim().toLowerCase() !== 'false'
    const where = [sql`e.action IN ('hard_ban', 'timed_pause')`]
    if (activeOnly) where.push(sql`e.active = true`)
    const whereSql = sql.join(where, sql` AND `)

    const result = await db.execute(sql`
      SELECT
        e.id,
        e.user_id,
        e.report_id,
        e.action,
        e.reason,
        e.note,
        e.active,
        e.starts_at,
        e.ends_at,
        e.created_by_admin_id,
        e.created_at,
        u.handle AS user_name,
        admin_u.name AS admin_name
      FROM user_enforcements e
      LEFT JOIN users u ON u.id = e.user_id
      LEFT JOIN admin_users admin_u ON admin_u.id = e.created_by_admin_id
      WHERE ${whereSql}
      ORDER BY e.created_at DESC
    `)

    const bans = rows(result).map((row) => ({
      id: row.id,
      userId: row.user_id,
      userName: row.user_name || 'Unknown',
      reportId: row.report_id,
      action: row.action,
      reason: row.reason || '',
      note: row.note || '',
      active: Boolean(row.active),
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      createdByAdminId: row.created_by_admin_id,
      createdByAdminName: row.admin_name || 'Unknown',
      createdAt: row.created_at,
    }))

    return res.json({ bans })
  } catch (err) {
    console.error('Trust bans list error:', err)
    return res.status(500).json({ error: 'Failed to load bans' })
  }
}

export async function getTrustSummary(req, res) {
  try {
    const now = new Date()
    const today = new Date(now)
    today.setUTCHours(0, 0, 0, 0)
    const slaThreshold = new Date(now.getTime() - 12 * 60 * 60 * 1000)

    const [openResult, slaResult, bansResult, appealsResult, resolveResult] = await Promise.all([
      db.execute(sql`SELECT COUNT(*)::int AS c FROM reports WHERE status = 'pending'`),
      db.execute(sql`SELECT COUNT(*)::int AS c FROM reports WHERE status = 'pending' AND created_at <= ${slaThreshold}`),
      db.execute(sql`SELECT COUNT(*)::int AS c FROM user_enforcements WHERE action IN ('hard_ban', 'timed_pause') AND created_at >= ${today}`),
      db.execute(sql`SELECT COUNT(*)::int AS c FROM appeals WHERE status = 'open'`),
      db.execute(sql`
        SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (reviewed_at - created_at)) / 3600), 0)::float AS hrs
        FROM reports
        WHERE reviewed_at IS NOT NULL AND status IN ('reviewed', 'actioned', 'dismissed')
      `),
    ])

    return res.json({
      openReports: Number(rows(openResult)[0]?.c || 0),
      slaBreaches: Number(rows(slaResult)[0]?.c || 0),
      bansToday: Number(rows(bansResult)[0]?.c || 0),
      appealsOpen: Number(rows(appealsResult)[0]?.c || 0),
      avgResolveHours: Number(rows(resolveResult)[0]?.hrs || 0),
      autoResolved: null,
    })
  } catch (err) {
    console.error('Trust summary error:', err)
    return res.status(500).json({ error: 'Failed to load trust summary' })
  }
}
