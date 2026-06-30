import { and, desc, eq, sql } from 'drizzle-orm'
import { db } from '../../../db/index.js'
import {
  notificationCampaignDeliveries,
  notificationCampaigns,
  notificationReengagementRules,
  notificationReengagementSends,
} from '../../../db/schema/notificationCampaigns.js'
import { queueCampaignSend, sendCampaignNow, sendReengagementRuleTest } from '../../services/notifications/campaignNotification.js'

const DEFAULT_REENGAGEMENT_RULES = [
  {
    name: '3-day reminder',
    title: 'You have 3 new likes 👀',
    body: 'People are checking you out — open the app to see who.',
    inactiveDays: 3,
    isEnabled: true,
    deeplink: 'ohrny://discover',
  },
  {
    name: '7-day reminder',
    title: 'We miss you 💛',
    body: "Your matches are still here. Come say hi before they cool off.",
    inactiveDays: 7,
    isEnabled: true,
    deeplink: 'ohrny://matches',
  },
  {
    name: '14-day reminder',
    title: 'Still looking for someone?',
    body: 'We found new people near you this week. Take a quick look.',
    inactiveDays: 14,
    isEnabled: true,
    deeplink: 'ohrny://discover',
  },
  {
    name: '30-day reminder',
    title: 'Your profile is going quiet 🌙',
    body: 'Reactivate now and get a free Boost to jump back to the top.',
    inactiveDays: 30,
    isEnabled: false,
    deeplink: 'ohrny://discover',
  },
]

function toIsoOrNull(value) {
  if (!value) return null
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return d
}

function normalizeDeliveryMode(value) {
  const mode = String(value || 'draft').trim().toLowerCase()
  if (mode === 'now' || mode === 'schedule' || mode === 'draft') return mode
  return 'draft'
}

async function ensureDefaultReengagementRules(adminId = null) {
  const existing = await db
    .select({ id: notificationReengagementRules.id })
    .from(notificationReengagementRules)
    .limit(1)
  if (existing.length > 0) return
  const now = new Date()
  await db
    .insert(notificationReengagementRules)
    .values(DEFAULT_REENGAGEMENT_RULES.map((rule) => ({
      ...rule,
      updatedByAdminId: adminId,
      createdAt: now,
      updatedAt: now,
    })))
}

export async function getNotificationsSummary(req, res) {
  try {
    const [statusRows, sentRows] = await Promise.all([
      db
        .select({
          status: notificationCampaigns.status,
          count: sql`COUNT(*)::int`,
        })
        .from(notificationCampaigns)
        .groupBy(notificationCampaigns.status),
      db
        .select({
          sent: sql`COALESCE(SUM(${notificationCampaigns.totalSent}), 0)::int`,
          failed: sql`COALESCE(SUM(${notificationCampaigns.totalFailed}), 0)::int`,
          campaigns: sql`COUNT(*)::int`,
        })
        .from(notificationCampaigns),
    ])

    const byStatus = Object.fromEntries(statusRows.map((row) => [row.status, Number(row.count || 0)]))
    const totals = sentRows[0] || { sent: 0, failed: 0, campaigns: 0 }

    return res.json({
      byStatus,
      totals: {
        campaigns: Number(totals.campaigns || 0),
        sent: Number(totals.sent || 0),
        failed: Number(totals.failed || 0),
      },
    })
  } catch (err) {
    console.error('Notifications summary error:', err)
    return res.status(500).json({ error: 'Failed to load notifications summary' })
  }
}

export async function listNotificationCampaigns(req, res) {
  try {
    const limit = Math.max(1, Math.min(100, Number.parseInt(String(req.query.limit || '30'), 10) || 30))
    const campaigns = await db
      .select()
      .from(notificationCampaigns)
      .orderBy(desc(notificationCampaigns.createdAt))
      .limit(limit)
    return res.json({ campaigns })
  } catch (err) {
    console.error('List campaigns error:', err)
    return res.status(500).json({ error: 'Failed to load campaigns' })
  }
}

export async function createNotificationCampaign(req, res) {
  try {
    const {
      name,
      title,
      body,
      deeplink,
      deliveryMode,
      scheduledAt,
      audienceType,
    } = req.body || {}

    if (!title || !body) {
      return res.status(400).json({ error: 'title and body are required' })
    }
    const mode = normalizeDeliveryMode(deliveryMode)
    const schedule = mode === 'schedule' ? toIsoOrNull(scheduledAt) : null
    if (mode === 'schedule' && !schedule) {
      return res.status(400).json({ error: 'scheduledAt is required for scheduled campaigns' })
    }

    const now = new Date()
    const [campaign] = await db
      .insert(notificationCampaigns)
      .values({
        name: String(name || title).trim().slice(0, 160),
        title: String(title).trim().slice(0, 160),
        body: String(body).trim(),
        deeplink: deeplink ? String(deeplink).trim().slice(0, 512) : null,
        audienceType: String(audienceType || 'all_users'),
        sendMode: mode,
        status: mode === 'schedule' ? 'scheduled' : mode === 'now' ? 'queued' : 'draft',
        scheduledAt: schedule,
        createdByAdminId: req.admin?.id || null,
        createdAt: now,
        updatedAt: now,
      })
      .returning()

    if (mode === 'now') {
      await queueCampaignSend(campaign.id, { triggeredBy: 'admin_create', sendMode: 'now' })
    }

    return res.status(201).json({ campaign })
  } catch (err) {
    console.error('Create campaign error:', err)
    return res.status(500).json({ error: 'Failed to create campaign' })
  }
}

export async function sendCampaignImmediately(req, res) {
  try {
    const { campaignId } = req.params
    const [campaign] = await db
      .select()
      .from(notificationCampaigns)
      .where(eq(notificationCampaigns.id, campaignId))
      .limit(1)
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' })
    if (campaign.status === 'cancelled') return res.status(400).json({ error: 'Campaign is cancelled' })

    await queueCampaignSend(campaignId, { triggeredBy: 'admin_send_now', sendMode: 'now' })
    return res.json({ ok: true, queued: true })
  } catch (err) {
    console.error('Send campaign now error:', err)
    return res.status(500).json({ error: 'Failed to queue campaign send' })
  }
}

export async function cancelScheduledCampaign(req, res) {
  try {
    const { campaignId } = req.params
    const [campaign] = await db
      .update(notificationCampaigns)
      .set({
        status: 'cancelled',
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(notificationCampaigns.id, campaignId),
          sql`${notificationCampaigns.status} IN ('draft', 'scheduled', 'queued', 'failed')`,
        ),
      )
      .returning()

    if (!campaign) return res.status(404).json({ error: 'Campaign not found or not cancellable' })
    return res.json({ ok: true, campaign })
  } catch (err) {
    console.error('Cancel campaign error:', err)
    return res.status(500).json({ error: 'Failed to cancel campaign' })
  }
}

export async function getCampaignDeliveries(req, res) {
  try {
    const { campaignId } = req.params
    const limit = Math.max(1, Math.min(500, Number.parseInt(String(req.query.limit || '200'), 10) || 200))
    const deliveries = await db
      .select()
      .from(notificationCampaignDeliveries)
      .where(eq(notificationCampaignDeliveries.campaignId, campaignId))
      .orderBy(desc(notificationCampaignDeliveries.createdAt))
      .limit(limit)

    return res.json({ deliveries })
  } catch (err) {
    console.error('Campaign deliveries error:', err)
    return res.status(500).json({ error: 'Failed to load campaign deliveries' })
  }
}

export async function retryCampaignSend(req, res) {
  try {
    const { campaignId } = req.params
    const outcome = await sendCampaignNow(campaignId, { triggeredBy: 'admin_retry' })
    if (!outcome.ok) return res.status(400).json({ error: outcome.error || 'Failed to send campaign' })
    return res.json({ ok: true, ...outcome })
  } catch (err) {
    console.error('Retry campaign error:', err)
    return res.status(500).json({ error: 'Failed to retry campaign' })
  }
}

export async function listReengagementRules(req, res) {
  try {
    await ensureDefaultReengagementRules(req.admin?.id || null)
    const rules = await db
      .select({
        id: notificationReengagementRules.id,
        name: notificationReengagementRules.name,
        title: notificationReengagementRules.title,
        body: notificationReengagementRules.body,
        deeplink: notificationReengagementRules.deeplink,
        inactiveDays: notificationReengagementRules.inactiveDays,
        isEnabled: notificationReengagementRules.isEnabled,
        updatedAt: notificationReengagementRules.updatedAt,
      })
      .from(notificationReengagementRules)
      .orderBy(notificationReengagementRules.inactiveDays)
    return res.json({ rules })
  } catch (err) {
    console.error('List reengagement rules error:', err)
    return res.status(500).json({ error: 'Failed to load re-engagement rules' })
  }
}

export async function updateReengagementRule(req, res) {
  try {
    const { ruleId } = req.params
    const { isEnabled, inactiveDays, title, body, deeplink } = req.body || {}
    const updates = {}
    if (typeof isEnabled === 'boolean') updates.isEnabled = isEnabled
    if (inactiveDays !== undefined) {
      const days = Number.parseInt(String(inactiveDays), 10)
      if (!Number.isFinite(days) || days < 1 || days > 180) {
        return res.status(400).json({ error: 'inactiveDays must be between 1 and 180' })
      }
      updates.inactiveDays = days
    }
    if (title !== undefined) {
      const v = String(title || '').trim().slice(0, 160)
      if (!v) return res.status(400).json({ error: 'title cannot be empty' })
      updates.title = v
    }
    if (body !== undefined) {
      const v = String(body || '').trim()
      if (!v) return res.status(400).json({ error: 'body cannot be empty' })
      updates.body = v
    }
    if (deeplink !== undefined) {
      updates.deeplink = deeplink ? String(deeplink).trim().slice(0, 512) : null
    }
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No updates provided' })
    }
    updates.updatedByAdminId = req.admin?.id || null
    updates.updatedAt = new Date()

    const [rule] = await db
      .update(notificationReengagementRules)
      .set(updates)
      .where(eq(notificationReengagementRules.id, ruleId))
      .returning()
    if (!rule) return res.status(404).json({ error: 'Rule not found' })
    return res.json({ rule })
  } catch (err) {
    console.error('Update reengagement rule error:', err)
    return res.status(500).json({ error: 'Failed to update re-engagement rule' })
  }
}

export async function testSendReengagementRule(req, res) {
  try {
    const { ruleId } = req.params
    const targetUserId = req.body?.userId || req.query?.userId
    if (!targetUserId) return res.status(400).json({ error: 'userId is required' })

    const [rule] = await db
      .select()
      .from(notificationReengagementRules)
      .where(eq(notificationReengagementRules.id, ruleId))
      .limit(1)
    if (!rule) return res.status(404).json({ error: 'Rule not found' })

    const result = await sendReengagementRuleTest(rule, targetUserId)
    if (!result.ok) return res.status(400).json({ error: 'No eligible devices to send test notification' })

    await db.insert(notificationReengagementSends).values({
      ruleId: rule.id,
      userId: targetUserId,
      deviceId: `manual-test-${Date.now()}`,
      status: 'sent',
      sentAt: new Date(),
      updatedAt: new Date(),
    })

    return res.json({ ok: true, sent: result.sent })
  } catch (err) {
    console.error('Test send reengagement rule error:', err)
    return res.status(500).json({ error: 'Failed to send test re-engagement notification' })
  }
}
