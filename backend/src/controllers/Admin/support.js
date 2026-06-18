import { sql } from 'drizzle-orm'
import { db } from '../../../db/index.js'

const ALLOWED_STATUS = new Set(['open', 'waiting', 'closed'])
const ALLOWED_SEVERITY = new Set(['low', 'medium', 'high'])
const SUPPORT_MACROS = [
  {
    id: 'billing_double_charge',
    title: 'Billing - double charge',
    body: 'Thanks for flagging this. We reviewed your billing history and escalated the duplicate charge for refund processing. You should see confirmation shortly.',
  },
  {
    id: 'verification_help',
    title: 'Verification assistance',
    body: 'Please retry verification with a clear photo, neutral lighting, and no filters. If it fails again, reply here and we will manually review your case.',
  },
  {
    id: 'gdpr_delete_flow',
    title: 'GDPR deletion request',
    body: 'We have received your account deletion and data erasure request. The process is now queued and we will confirm as soon as deletion is completed.',
  },
  {
    id: 'ban_review_ack',
    title: 'Ban review acknowledgment',
    body: 'Your request has been escalated to moderation for a policy review. We will update this ticket once the review is finalized.',
  },
]

function rows(result) {
  return result.rows || result || []
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function formatRelative(date) {
  if (!date) return '—'
  const then = new Date(date).getTime()
  if (!Number.isFinite(then)) return '—'
  const mins = Math.max(0, Math.floor((Date.now() - then) / 60000))
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  return `${days}d`
}

function normalizeSeverity(value, fallback = 'low') {
  const normalized = String(value || '').trim().toLowerCase()
  if (normalized === 'med') return 'medium'
  if (ALLOWED_SEVERITY.has(normalized)) return normalized
  return fallback
}

function buildTicketNo() {
  const part = Math.floor(100000 + (Math.random() * 900000))
  return `T-${part}`
}

function csvEscape(value) {
  const str = value == null ? '' : String(value)
  if (/["\n,]/.test(str)) return `"${str.replace(/"/g, '""')}"`
  return str
}

function serializeTicket(row) {
  return {
    id: row.id,
    ticketNo: row.ticket_no,
    subject: row.subject,
    description: row.description || '',
    requester: row.requester_id
      ? {
          id: row.requester_id,
          handle: row.requester_handle || 'unknown',
        }
      : null,
    severity: row.severity,
    status: row.status,
    assignee: row.assignee_admin_id
      ? {
          id: row.assignee_admin_id,
          name: row.assignee_name || 'Unknown',
        }
      : null,
    source: row.source,
    age: formatRelative(row.created_at),
    firstResponseAt: row.first_responded_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

async function getTicketRow(ticketId) {
  const result = await db.execute(sql`
    SELECT
      t.*,
      requester.id AS requester_id,
      requester.handle AS requester_handle,
      assignee.id AS assignee_admin_id,
      assignee.name AS assignee_name
    FROM support_tickets t
    LEFT JOIN users requester ON requester.id = t.requester_user_id
    LEFT JOIN admin_users assignee ON assignee.id = t.assignee_admin_id
    WHERE t.id = ${ticketId}
    LIMIT 1
  `)
  return rows(result)[0] || null
}

export async function getSupportSummary(req, res) {
  try {
    const countsResult = await db.execute(sql`
      SELECT
        COUNT(*) FILTER (WHERE status = 'open')::int AS open_tickets,
        COUNT(*) FILTER (WHERE status = 'waiting')::int AS waiting_tickets,
        COUNT(*) FILTER (WHERE status = 'closed')::int AS closed_tickets
      FROM support_tickets
    `)
    const counts = rows(countsResult)[0] || {}

    const firstResponseResult = await db.execute(sql`
      SELECT
        COALESCE(
          ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (
            ORDER BY EXTRACT(EPOCH FROM (first_responded_at - created_at)) / 60.0
          ))::int,
          0
        ) AS median_minutes
      FROM support_tickets
      WHERE first_responded_at IS NOT NULL
    `)
    const medianFirstResponseMinutes = Number(rows(firstResponseResult)[0]?.median_minutes || 0)

    const csatResult = await db.execute(sql`
      SELECT COALESCE(AVG(csat_score)::numeric(10,2), 0) AS avg_csat
      FROM (
        SELECT csat_score
        FROM support_tickets
        WHERE csat_score IS NOT NULL
        ORDER BY updated_at DESC
        LIMIT 50
      ) recent
    `)
    const csat = Number(rows(csatResult)[0]?.avg_csat || 0)

    const agentsResult = await db.execute(sql`
      SELECT
        COUNT(*) FILTER (WHERE role = 'support' AND is_active = true)::int AS total_support,
        COUNT(*) FILTER (
          WHERE role = 'support'
            AND is_active = true
            AND last_login_at IS NOT NULL
            AND last_login_at >= NOW() - INTERVAL '12 hours'
        )::int AS online_support
      FROM admin_users
    `)
    const agents = rows(agentsResult)[0] || {}

    return res.json({
      openTickets: Number(counts.open_tickets || 0),
      waitingTickets: Number(counts.waiting_tickets || 0),
      closedTickets: Number(counts.closed_tickets || 0),
      medianFirstResponseMinutes,
      csat,
      agentsOnline: Number(agents.online_support || 0),
      agentsTotal: Number(agents.total_support || 0),
    })
  } catch (err) {
    console.error('Support summary error:', err)
    return res.status(500).json({ error: 'Failed to load support summary' })
  }
}

export async function listSupportTickets(req, res) {
  try {
    const page = clamp(parseInt(req.query.page, 10) || 1, 1, 9999)
    const limit = clamp(parseInt(req.query.limit, 10) || 20, 5, 100)
    const offset = (page - 1) * limit
    const q = String(req.query.q || '').trim()
    const status = String(req.query.status || 'all').trim().toLowerCase()
    const severity = String(req.query.severity || 'any').trim().toLowerCase()
    const assignee = String(req.query.assignee || 'any').trim()

    if (status !== 'all' && !ALLOWED_STATUS.has(status)) {
      return res.status(400).json({ error: 'Invalid status filter' })
    }
    if (severity !== 'any' && !ALLOWED_SEVERITY.has(normalizeSeverity(severity, ''))) {
      return res.status(400).json({ error: 'Invalid severity filter' })
    }

    const where = [sql`1=1`]
    if (status !== 'all') where.push(sql`t.status = ${status}`)
    if (severity !== 'any') where.push(sql`t.severity = ${normalizeSeverity(severity)}`)
    if (assignee === 'unassigned') where.push(sql`t.assignee_admin_id IS NULL`)
    else if (assignee && assignee !== 'any') where.push(sql`t.assignee_admin_id = ${assignee}`)
    if (q) {
      const like = `%${q}%`
      where.push(sql`(
        t.ticket_no ILIKE ${like}
        OR t.subject ILIKE ${like}
        OR requester.handle ILIKE ${like}
        OR requester.id::text ILIKE ${like}
      )`)
    }
    const whereSql = sql.join(where, sql` AND `)

    const countResult = await db.execute(sql`
      SELECT COUNT(*)::int AS total
      FROM support_tickets t
      LEFT JOIN users requester ON requester.id = t.requester_user_id
      WHERE ${whereSql}
    `)
    const total = Number(rows(countResult)[0]?.total || 0)

    const listResult = await db.execute(sql`
      SELECT
        t.*,
        requester.id AS requester_id,
        requester.handle AS requester_handle,
        assignee.id AS assignee_admin_id,
        assignee.name AS assignee_name
      FROM support_tickets t
      LEFT JOIN users requester ON requester.id = t.requester_user_id
      LEFT JOIN admin_users assignee ON assignee.id = t.assignee_admin_id
      WHERE ${whereSql}
      ORDER BY
        CASE
          WHEN t.status = 'open' THEN 0
          WHEN t.status = 'waiting' THEN 1
          ELSE 2
        END,
        t.created_at DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `)

    return res.json({
      tickets: rows(listResult).map(serializeTicket),
      pagination: {
        page,
        limit,
        total,
        pages: Math.max(1, Math.ceil(total / limit)),
      },
    })
  } catch (err) {
    console.error('Support tickets list error:', err)
    return res.status(500).json({ error: 'Failed to load tickets' })
  }
}

export async function getSupportTicketDetail(req, res) {
  try {
    const { ticketId } = req.params
    const ticket = await getTicketRow(ticketId)
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' })

    const messagesResult = await db.execute(sql`
      SELECT
        m.id,
        m.kind,
        m.body,
        m.is_internal,
        m.created_at,
        m.author_user_id,
        m.author_admin_id,
        u.handle AS author_user_handle,
        a.name AS author_admin_name
      FROM support_ticket_messages m
      LEFT JOIN users u ON u.id = m.author_user_id
      LEFT JOIN admin_users a ON a.id = m.author_admin_id
      WHERE m.ticket_id = ${ticketId}
      ORDER BY m.created_at ASC
    `)

    const messages = rows(messagesResult).map((m) => ({
      id: m.id,
      kind: m.kind,
      body: m.body,
      isInternal: Boolean(m.is_internal),
      createdAt: m.created_at,
      author:
        m.author_admin_id
          ? { type: 'admin', id: m.author_admin_id, label: m.author_admin_name || 'Admin' }
          : m.author_user_id
            ? { type: 'user', id: m.author_user_id, label: m.author_user_handle || 'User' }
            : { type: 'system', id: null, label: 'System' },
    }))

    return res.json({
      ticket: serializeTicket(ticket),
      messages,
    })
  } catch (err) {
    console.error('Support ticket detail error:', err)
    return res.status(500).json({ error: 'Failed to load ticket detail' })
  }
}

export async function createSupportTicket(req, res) {
  try {
    const subject = String(req.body?.subject || '').trim()
    const description = String(req.body?.description || '').trim()
    const requesterUserId = String(req.body?.requesterUserId || '').trim() || null
    const severity = normalizeSeverity(req.body?.severity, 'low')
    const category = String(req.body?.category || 'general').trim().toLowerCase() || 'general'
    const source = 'admin'

    if (subject.length < 3) return res.status(400).json({ error: 'Subject is too short' })
    if (subject.length > 180) return res.status(400).json({ error: 'Subject is too long' })
    if (description.length > 4000) return res.status(400).json({ error: 'Description is too long' })

    const now = new Date()
    const ticketNo = buildTicketNo()
    const adminId = req.admin?.id || null

    const createdResult = await db.execute(sql`
      INSERT INTO support_tickets (
        ticket_no,
        requester_user_id,
        created_by_admin_id,
        subject,
        description,
        category,
        severity,
        status,
        source,
        assignee_admin_id,
        last_message_at,
        created_at,
        updated_at
      ) VALUES (
        ${ticketNo},
        ${requesterUserId},
        ${adminId},
        ${subject},
        ${description || null},
        ${category},
        ${severity},
        'open',
        ${source},
        ${adminId},
        ${now},
        ${now},
        ${now}
      )
      RETURNING id
    `)
    const ticketId = rows(createdResult)[0]?.id
    if (!ticketId) return res.status(500).json({ error: 'Failed to create ticket' })

    if (description) {
      await db.execute(sql`
        INSERT INTO support_ticket_messages (
          ticket_id,
          author_admin_id,
          kind,
          body,
          is_internal,
          created_at
        ) VALUES (
          ${ticketId},
          ${adminId},
          'internal_note',
          ${description},
          true,
          ${now}
        )
      `)
    }

    const ticket = await getTicketRow(ticketId)
    return res.status(201).json({
      ok: true,
      ticket: serializeTicket(ticket),
    })
  } catch (err) {
    console.error('Support ticket create error:', err)
    return res.status(500).json({ error: 'Failed to create ticket' })
  }
}

export async function updateSupportTicket(req, res) {
  try {
    const { ticketId } = req.params
    const existing = await getTicketRow(ticketId)
    if (!existing) return res.status(404).json({ error: 'Ticket not found' })

    const hasStatus = Object.prototype.hasOwnProperty.call(req.body || {}, 'status')
    const hasSeverity = Object.prototype.hasOwnProperty.call(req.body || {}, 'severity')
    const hasAssignee = Object.prototype.hasOwnProperty.call(req.body || {}, 'assigneeAdminId')
    const hasCsat = Object.prototype.hasOwnProperty.call(req.body || {}, 'csatScore')

    const status = String(req.body?.status || '').trim().toLowerCase()
    const severity = normalizeSeverity(req.body?.severity, '')
    const assigneeAdminIdRaw = req.body?.assigneeAdminId
    const assigneeAdminId = assigneeAdminIdRaw ? String(assigneeAdminIdRaw).trim() : null
    const csatScore = req.body?.csatScore

    if (hasStatus && !ALLOWED_STATUS.has(status)) {
      return res.status(400).json({ error: 'Invalid status' })
    }
    if (hasSeverity && !ALLOWED_SEVERITY.has(severity)) {
      return res.status(400).json({ error: 'Invalid severity' })
    }
    if (hasCsat && (Number.isNaN(Number(csatScore)) || Number(csatScore) < 1 || Number(csatScore) > 5)) {
      return res.status(400).json({ error: 'csatScore must be between 1 and 5' })
    }
    if (!hasStatus && !hasSeverity && !hasAssignee && !hasCsat) {
      return res.status(400).json({ error: 'No changes provided' })
    }

    const now = new Date()
    const updates = [sql`updated_at = ${now}`]
    if (hasStatus) {
      updates.push(sql`status = ${status}`)
      updates.push(sql`closed_at = ${status === 'closed' ? now : null}`)
    }
    if (hasSeverity) updates.push(sql`severity = ${severity}`)
    if (hasAssignee) updates.push(sql`assignee_admin_id = ${assigneeAdminId}`)
    if (hasCsat) updates.push(sql`csat_score = ${Math.round(Number(csatScore))}`)

    await db.execute(sql`
      UPDATE support_tickets
      SET ${sql.join(updates, sql`, `)}
      WHERE id = ${ticketId}
    `)

    if (hasStatus && status !== existing.status) {
      await db.execute(sql`
        INSERT INTO support_ticket_messages (
          ticket_id,
          author_admin_id,
          kind,
          body,
          is_internal,
          created_at
        ) VALUES (
          ${ticketId},
          ${req.admin?.id || null},
          'status_change',
          ${`Status changed to ${status}`},
          true,
          ${now}
        )
      `)
    }

    if (hasAssignee && assigneeAdminId !== existing.assignee_admin_id) {
      const label = assigneeAdminId ? 'Ticket assigned' : 'Ticket unassigned'
      await db.execute(sql`
        INSERT INTO support_ticket_messages (
          ticket_id,
          author_admin_id,
          kind,
          body,
          is_internal,
          created_at
        ) VALUES (
          ${ticketId},
          ${req.admin?.id || null},
          'assignment_change',
          ${label},
          true,
          ${now}
        )
      `)
    }

    const ticket = await getTicketRow(ticketId)
    return res.json({ ok: true, ticket: serializeTicket(ticket) })
  } catch (err) {
    console.error('Support ticket update error:', err)
    return res.status(500).json({ error: 'Failed to update ticket' })
  }
}

export async function replySupportTicket(req, res) {
  try {
    const { ticketId } = req.params
    const ticket = await getTicketRow(ticketId)
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' })

    const body = String(req.body?.body || '').trim()
    const isInternal = Boolean(req.body?.isInternal)
    if (!body) return res.status(400).json({ error: 'Reply body is required' })
    if (body.length > 4000) return res.status(400).json({ error: 'Reply is too long' })

    const now = new Date()
    await db.execute(sql`
      INSERT INTO support_ticket_messages (
        ticket_id,
        author_admin_id,
        kind,
        body,
        is_internal,
        created_at
      ) VALUES (
        ${ticketId},
        ${req.admin?.id || null},
        ${isInternal ? 'internal_note' : 'reply'},
        ${body},
        ${isInternal},
        ${now}
      )
    `)

    if (isInternal) {
      await db.execute(sql`
        UPDATE support_tickets
        SET last_message_at = ${now}, updated_at = ${now}
        WHERE id = ${ticketId}
      `)
    } else {
      await db.execute(sql`
        UPDATE support_tickets
        SET
          first_responded_at = COALESCE(first_responded_at, ${now}),
          last_message_at = ${now},
          updated_at = ${now}
        WHERE id = ${ticketId}
      `)
    }

    return res.json({ ok: true })
  } catch (err) {
    console.error('Support ticket reply error:', err)
    return res.status(500).json({ error: 'Failed to post reply' })
  }
}

export async function assignSupportTicketToMe(req, res) {
  try {
    const { ticketId } = req.params
    const ticket = await getTicketRow(ticketId)
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' })

    const now = new Date()
    await db.execute(sql`
      UPDATE support_tickets
      SET assignee_admin_id = ${req.admin?.id || null}, updated_at = ${now}
      WHERE id = ${ticketId}
    `)

    await db.execute(sql`
      INSERT INTO support_ticket_messages (
        ticket_id,
        author_admin_id,
        kind,
        body,
        is_internal,
        created_at
      ) VALUES (
        ${ticketId},
        ${req.admin?.id || null},
        'assignment_change',
        'Ticket assigned to current admin',
        true,
        ${now}
      )
    `)

    const updated = await getTicketRow(ticketId)
    return res.json({ ok: true, ticket: serializeTicket(updated) })
  } catch (err) {
    console.error('Support assign-to-me error:', err)
    return res.status(500).json({ error: 'Failed to assign ticket' })
  }
}

export async function listSupportMacros(req, res) {
  return res.json({ macros: SUPPORT_MACROS })
}

export async function exportWeeklySupportReport(req, res) {
  try {
    const days = clamp(parseInt(req.query.days, 10) || 7, 1, 31)
    const fromDate = new Date(Date.now() - (days * 24 * 60 * 60 * 1000))

    const reportResult = await db.execute(sql`
      SELECT
        t.ticket_no,
        t.subject,
        t.status,
        t.severity,
        COALESCE(requester.handle, '') AS requester_handle,
        COALESCE(assignee.name, '') AS assignee_name,
        t.first_responded_at,
        t.closed_at,
        t.csat_score,
        t.created_at
      FROM support_tickets t
      LEFT JOIN users requester ON requester.id = t.requester_user_id
      LEFT JOIN admin_users assignee ON assignee.id = t.assignee_admin_id
      WHERE t.created_at >= ${fromDate}
      ORDER BY t.created_at DESC
    `)
    const dataRows = rows(reportResult)

    const header = [
      'ticket_no',
      'subject',
      'status',
      'severity',
      'requester',
      'assignee',
      'first_responded_at',
      'closed_at',
      'csat_score',
      'created_at',
    ]
    const lines = [header.join(',')]
    dataRows.forEach((r) => {
      lines.push([
        csvEscape(r.ticket_no),
        csvEscape(r.subject),
        csvEscape(r.status),
        csvEscape(r.severity),
        csvEscape(r.requester_handle),
        csvEscape(r.assignee_name),
        csvEscape(r.first_responded_at),
        csvEscape(r.closed_at),
        csvEscape(r.csat_score),
        csvEscape(r.created_at),
      ].join(','))
    })

    const csv = lines.join('\n')
    const stamp = new Date().toISOString().slice(0, 10)
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="support-weekly-report-${stamp}.csv"`)
    return res.status(200).send(csv)
  } catch (err) {
    console.error('Support weekly report export error:', err)
    return res.status(500).json({ error: 'Failed to export weekly report' })
  }
}
