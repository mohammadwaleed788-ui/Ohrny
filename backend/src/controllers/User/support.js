import { sql } from 'drizzle-orm'
import { db } from '../../../db/index.js'

const ALLOWED_SEVERITY = new Set(['low', 'medium', 'high'])
const ALLOWED_USER_REPLY_STATUS = new Set(['open', 'waiting'])

function rows(result) {
  return result.rows || result || []
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

function serializeUserTicket(row) {
  return {
    id: row.id,
    ticketNo: row.ticket_no,
    subject: row.subject,
    description: row.description || '',
    severity: row.severity,
    status: row.status,
    age: formatRelative(row.created_at),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    closedAt: row.closed_at,
  }
}

async function getOwnedTicket(ticketId, userId) {
  const result = await db.execute(sql`
    SELECT *
    FROM support_tickets
    WHERE id = ${ticketId} AND requester_user_id = ${userId}
    LIMIT 1
  `)
  return rows(result)[0] || null
}

export async function createSupportTicket(req, res) {
  try {
    const userId = req.user.id
    const subject = String(req.body?.subject || '').trim()
    const description = String(req.body?.description || '').trim()
    const category = String(req.body?.category || 'general').trim().toLowerCase() || 'general'
    const severity = normalizeSeverity(req.body?.severity, 'low')

    if (subject.length < 3) return res.status(400).json({ error: 'Subject is too short' })
    if (subject.length > 180) return res.status(400).json({ error: 'Subject is too long' })
    if (!description) return res.status(400).json({ error: 'Description is required' })
    if (description.length > 4000) return res.status(400).json({ error: 'Description is too long' })

    const now = new Date()
    const ticketNo = buildTicketNo()

    const ticketResult = await db.execute(sql`
      INSERT INTO support_tickets (
        ticket_no,
        requester_user_id,
        subject,
        description,
        category,
        severity,
        status,
        source,
        last_message_at,
        created_at,
        updated_at
      ) VALUES (
        ${ticketNo},
        ${userId},
        ${subject},
        ${description},
        ${category},
        ${severity},
        'open',
        'user',
        ${now},
        ${now},
        ${now}
      )
      RETURNING id, ticket_no, status, severity, created_at
    `)
    const created = rows(ticketResult)[0]

    await db.execute(sql`
      INSERT INTO support_ticket_messages (
        ticket_id,
        author_user_id,
        kind,
        body,
        is_internal,
        created_at
      ) VALUES (
        ${created.id},
        ${userId},
        'reply',
        ${description},
        false,
        ${now}
      )
    `)

    return res.status(201).json({
      ok: true,
      ticket: {
        id: created.id,
        ticketNo: created.ticket_no,
        status: created.status,
        severity: created.severity,
        createdAt: created.created_at,
      },
    })
  } catch (err) {
    console.error('createSupportTicket error:', err.message)
    return res.status(500).json({ error: 'Failed to submit support ticket' })
  }
}

export async function listUserSupportTickets(req, res) {
  try {
    const userId = req.user.id
    const status = String(req.query?.status || 'all').trim().toLowerCase()
    const whereStatus = status === 'all' ? null : status
    if (whereStatus && !['open', 'waiting', 'closed'].includes(whereStatus)) {
      return res.status(400).json({ error: 'Invalid status filter' })
    }

    const listResult = await db.execute(sql`
      SELECT
        id,
        ticket_no,
        subject,
        description,
        severity,
        status,
        closed_at,
        created_at,
        updated_at
      FROM support_tickets
      WHERE requester_user_id = ${userId}
        AND (${whereStatus}::text IS NULL OR status = ${whereStatus})
      ORDER BY created_at DESC
      LIMIT 100
    `)

    return res.json({
      tickets: rows(listResult).map(serializeUserTicket),
    })
  } catch (err) {
    console.error('listUserSupportTickets error:', err.message)
    return res.status(500).json({ error: 'Failed to load support tickets' })
  }
}

export async function getUserSupportTicketDetail(req, res) {
  try {
    const userId = req.user.id
    const { ticketId } = req.params
    const ticket = await getOwnedTicket(ticketId, userId)
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
        a.name AS author_admin_name
      FROM support_ticket_messages m
      LEFT JOIN admin_users a ON a.id = m.author_admin_id
      WHERE m.ticket_id = ${ticketId}
        AND m.is_internal = false
      ORDER BY m.created_at ASC
    `)

    const messages = rows(messagesResult).map((m) => ({
      id: m.id,
      kind: m.kind,
      body: m.body,
      createdAt: m.created_at,
      author: m.author_admin_id
        ? { type: 'admin', id: m.author_admin_id, label: m.author_admin_name || 'Support' }
        : { type: 'user', id: m.author_user_id, label: 'You' },
    }))

    return res.json({
      ticket: serializeUserTicket(ticket),
      messages,
    })
  } catch (err) {
    console.error('getUserSupportTicketDetail error:', err.message)
    return res.status(500).json({ error: 'Failed to load ticket detail' })
  }
}

export async function replyUserSupportTicket(req, res) {
  try {
    const userId = req.user.id
    const { ticketId } = req.params
    const body = String(req.body?.body || '').trim()
    if (!body) return res.status(400).json({ error: 'Reply body is required' })
    if (body.length > 4000) return res.status(400).json({ error: 'Reply is too long' })

    const ticket = await getOwnedTicket(ticketId, userId)
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' })
    if (!ALLOWED_USER_REPLY_STATUS.has(ticket.status)) {
      return res.status(400).json({ error: 'Cannot reply to a closed ticket' })
    }

    const now = new Date()
    await db.execute(sql`
      INSERT INTO support_ticket_messages (
        ticket_id,
        author_user_id,
        kind,
        body,
        is_internal,
        created_at
      ) VALUES (
        ${ticketId},
        ${userId},
        'reply',
        ${body},
        false,
        ${now}
      )
    `)

    await db.execute(sql`
      UPDATE support_tickets
      SET
        status = CASE WHEN status = 'waiting' THEN 'open' ELSE status END,
        last_message_at = ${now},
        updated_at = ${now}
      WHERE id = ${ticketId}
    `)

    return res.json({ ok: true })
  } catch (err) {
    console.error('replyUserSupportTicket error:', err.message)
    return res.status(500).json({ error: 'Failed to post reply' })
  }
}

export async function rateUserSupportTicket(req, res) {
  try {
    const userId = req.user.id
    const { ticketId } = req.params
    const csatScore = Math.round(Number(req.body?.csatScore || 0))
    if (!Number.isFinite(csatScore) || csatScore < 1 || csatScore > 5) {
      return res.status(400).json({ error: 'csatScore must be between 1 and 5' })
    }

    const ticket = await getOwnedTicket(ticketId, userId)
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' })

    await db.execute(sql`
      UPDATE support_tickets
      SET csat_score = ${csatScore}, updated_at = NOW()
      WHERE id = ${ticketId}
    `)

    return res.json({ ok: true, csatScore })
  } catch (err) {
    console.error('rateUserSupportTicket error:', err.message)
    return res.status(500).json({ error: 'Failed to submit CSAT' })
  }
}
