import { and, eq, inArray, isNull, lte, sql } from 'drizzle-orm'
import { db } from '../../../db/index.js'
import { users } from '../../../db/schema/users.js'
import { userPrivacySettings } from '../../../db/schema/settings.js'
import { userDevices } from '../../../db/schema/userDevices.js'
import {
  notificationCampaigns,
  notificationCampaignDeliveries,
  notificationReengagementRules,
  notificationReengagementSends,
  notificationCampaignTargets,
} from '../../../db/schema/notificationCampaigns.js'
import { sendPushNotificationDetailed } from './firebase.js'
import { emitAdminCampaignEvent } from '../../socket/index.js'

const FCM_BATCH_SIZE = 500
const REENGAGE_DEDUP_HOURS = 24

function chunkArray(items, size) {
  const chunks = []
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size))
  }
  return chunks
}

function eventPayload(campaignId, patch = {}) {
  return {
    campaignId,
    at: new Date().toISOString(),
    ...patch,
  }
}

async function resolveAudienceUserIds(audienceType = 'all_users') {
  if (audienceType !== 'all_users') {
    return []
  }
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(isNull(users.deletedAt))
  return rows.map((row) => row.id)
}

async function replaceCampaignTargets(campaignId, userIds) {
  await db.delete(notificationCampaignTargets).where(eq(notificationCampaignTargets.campaignId, campaignId))
  if (!userIds.length) return

  const values = userIds.map((userId) => ({ campaignId, userId }))
  for (const batch of chunkArray(values, 2000)) {
    await db.insert(notificationCampaignTargets).values(batch)
  }
}

async function loadCampaignDevices(campaignId) {
  return db
    .select({
      userId: userDevices.userId,
      deviceId: userDevices.deviceId,
      fcmToken: userDevices.fcmToken,
    })
    .from(notificationCampaignTargets)
    .innerJoin(userDevices, eq(userDevices.userId, notificationCampaignTargets.userId))
    .innerJoin(users, eq(users.id, notificationCampaignTargets.userId))
    .leftJoin(userPrivacySettings, eq(userPrivacySettings.userId, notificationCampaignTargets.userId))
    .where(
      and(
        eq(notificationCampaignTargets.campaignId, campaignId),
        eq(userDevices.pushNotificationEnabled, true),
        isNull(users.deletedAt),
        sql`COALESCE(${userPrivacySettings.campaignNotificationsEnabled}, true) = true`,
        sql`${userDevices.fcmToken} IS NOT NULL`,
        sql`length(trim(${userDevices.fcmToken})) > 0`,
      ),
    )
}

async function markCampaignFailed(campaignId, error) {
  await db
    .update(notificationCampaigns)
    .set({
      status: 'failed',
      lastError: String(error || 'Unknown campaign error'),
      updatedAt: new Date(),
    })
    .where(eq(notificationCampaigns.id, campaignId))
}

export async function sendCampaignNow(campaignId, { triggeredBy = 'system' } = {}) {
  const [campaign] = await db
    .select()
    .from(notificationCampaigns)
    .where(eq(notificationCampaigns.id, campaignId))
    .limit(1)

  if (!campaign) {
    return { ok: false, error: 'Campaign not found' }
  }
  if (campaign.status === 'cancelled') {
    return { ok: false, error: 'Campaign is cancelled' }
  }

  try {
    emitAdminCampaignEvent('campaign:queued', eventPayload(campaignId, { status: 'queued', triggeredBy }))
    await db
      .update(notificationCampaigns)
      .set({
        status: 'sending',
        sentAt: campaign.sentAt || new Date(),
        updatedAt: new Date(),
        lastError: null,
      })
      .where(eq(notificationCampaigns.id, campaignId))

    emitAdminCampaignEvent('campaign:progress', eventPayload(campaignId, { status: 'sending', processed: 0 }))

    const audienceUserIds = await resolveAudienceUserIds(campaign.audienceType)
    await replaceCampaignTargets(campaignId, audienceUserIds)
    await db
      .update(notificationCampaigns)
      .set({ totalTargets: audienceUserIds.length, updatedAt: new Date() })
      .where(eq(notificationCampaigns.id, campaignId))

    if (audienceUserIds.length === 0) {
      await db
        .update(notificationCampaigns)
        .set({
          status: 'completed',
          totalTargets: 0,
          totalSent: 0,
          totalFailed: 0,
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(notificationCampaigns.id, campaignId))
      emitAdminCampaignEvent('campaign:completed', eventPayload(campaignId, { status: 'completed', sent: 0, failed: 0 }))
      return { ok: true, sent: 0, failed: 0, targets: 0 }
    }

    const devices = await loadCampaignDevices(campaignId)
    if (!devices.length) {
      await db
        .update(notificationCampaigns)
        .set({
          status: 'completed',
          totalSent: 0,
          totalFailed: 0,
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(notificationCampaigns.id, campaignId))
      emitAdminCampaignEvent('campaign:completed', eventPayload(campaignId, { status: 'completed', sent: 0, failed: 0 }))
      return { ok: true, sent: 0, failed: 0, targets: audienceUserIds.length }
    }

    let sentCount = 0
    let failedCount = 0
    let processed = 0
    const batches = chunkArray(devices, FCM_BATCH_SIZE)

    for (const batch of batches) {
      const now = new Date()
      const tokens = batch.map((item) => item.fcmToken)
      const response = await sendPushNotificationDetailed(
        tokens,
        {
          title: campaign.title,
          body: campaign.body,
        },
        {
          type: 'campaign',
          campaignId,
          deeplink: campaign.deeplink || '',
        },
      )

      const deliveries = batch.map((device, idx) => {
        const itemResp = response.responses[idx]
        const success = !!itemResp?.success
        if (success) sentCount += 1
        else failedCount += 1

        return {
          campaignId,
          userId: device.userId,
          deviceId: device.deviceId,
          fcmToken: device.fcmToken,
          status: success ? 'sent' : 'failed',
          errorMessage: success ? null : (itemResp?.error?.message || itemResp?.error?.code || 'unknown_send_error'),
          sentAt: success ? now : null,
          updatedAt: now,
        }
      })

      await db
        .insert(notificationCampaignDeliveries)
        .values(deliveries)
        .onConflictDoUpdate({
          target: [notificationCampaignDeliveries.campaignId, notificationCampaignDeliveries.deviceId],
          set: {
            fcmToken: sql`excluded.fcm_token`,
            status: sql`excluded.status`,
            errorMessage: sql`excluded.error_message`,
            sentAt: sql`excluded.sent_at`,
            updatedAt: sql`excluded.updated_at`,
          },
        })

      processed += batch.length
      await db
        .update(notificationCampaigns)
        .set({
          totalSent: sentCount,
          totalFailed: failedCount,
          updatedAt: new Date(),
        })
        .where(eq(notificationCampaigns.id, campaignId))

      emitAdminCampaignEvent('campaign:progress', eventPayload(campaignId, {
        status: 'sending',
        processed,
        totalDevices: devices.length,
        sent: sentCount,
        failed: failedCount,
      }))
    }

    await db
      .update(notificationCampaigns)
      .set({
        status: 'completed',
        totalSent: sentCount,
        totalFailed: failedCount,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(notificationCampaigns.id, campaignId))

    emitAdminCampaignEvent('campaign:completed', eventPayload(campaignId, {
      status: 'completed',
      sent: sentCount,
      failed: failedCount,
      totalDevices: devices.length,
    }))
    return { ok: true, sent: sentCount, failed: failedCount, targets: audienceUserIds.length }
  } catch (err) {
    await markCampaignFailed(campaignId, err?.message || err)
    emitAdminCampaignEvent('campaign:failed', eventPayload(campaignId, {
      status: 'failed',
      error: err?.message || 'Campaign send failed',
    }))
    return { ok: false, error: err?.message || 'Campaign send failed' }
  }
}

export async function queueCampaignSend(campaignId, options = {}) {
  await db
    .update(notificationCampaigns)
    .set({
      status: 'queued',
      sendMode: options.sendMode || 'now',
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(notificationCampaigns.id, campaignId),
        inArray(notificationCampaigns.status, ['draft', 'scheduled', 'queued', 'failed']),
      ),
    )

  setTimeout(() => {
    sendCampaignNow(campaignId, options).catch((err) => {
      console.error('queueCampaignSend error:', err.message)
    })
  }, 0)
}

export async function runDueScheduledCampaigns() {
  const now = new Date()
  const due = await db
    .select({ id: notificationCampaigns.id })
    .from(notificationCampaigns)
    .where(
      and(
        eq(notificationCampaigns.status, 'scheduled'),
        sql`${notificationCampaigns.scheduledAt} <= ${now}`,
      ),
    )
    .limit(20)

  for (const campaign of due) {
    await queueCampaignSend(campaign.id, { triggeredBy: 'scheduler', sendMode: 'schedule' })
  }
  return due.length
}

async function loadEligibleInactiveDevicesForRule(rule) {
  const cutoff = new Date(Date.now() - Number(rule.inactiveDays || 7) * 24 * 60 * 60 * 1000)
  const dedupSince = new Date(Date.now() - REENGAGE_DEDUP_HOURS * 60 * 60 * 1000)

  return db
    .select({
      userId: userDevices.userId,
      deviceId: userDevices.deviceId,
      fcmToken: userDevices.fcmToken,
    })
    .from(userDevices)
    .innerJoin(users, eq(users.id, userDevices.userId))
    .leftJoin(userPrivacySettings, eq(userPrivacySettings.userId, userDevices.userId))
    .where(
      and(
        eq(userDevices.pushNotificationEnabled, true),
        isNull(users.deletedAt),
        lte(users.lastActiveAt, cutoff),
        sql`COALESCE(${userPrivacySettings.campaignNotificationsEnabled}, true) = true`,
        sql`${userDevices.fcmToken} IS NOT NULL`,
        sql`length(trim(${userDevices.fcmToken})) > 0`,
        sql`NOT EXISTS (
          SELECT 1
          FROM ${notificationReengagementSends} s
          WHERE s.rule_id = ${rule.id}
            AND s.device_id = ${userDevices.deviceId}
            AND s.status = 'sent'
            AND s.sent_at >= ${dedupSince}
        )`,
      ),
    )
}

export async function runReengagementRules() {
  const rules = await db
    .select()
    .from(notificationReengagementRules)
    .where(eq(notificationReengagementRules.isEnabled, true))

  let sendCount = 0
  for (const rule of rules) {
    const devices = await loadEligibleInactiveDevicesForRule(rule)
    if (!devices.length) continue

    for (const batch of chunkArray(devices, FCM_BATCH_SIZE)) {
      const now = new Date()
      const tokens = batch.map((item) => item.fcmToken)
      const response = await sendPushNotificationDetailed(
        tokens,
        { title: rule.title, body: rule.body },
        {
          type: 'campaign',
          campaignId: '',
          deeplink: rule.deeplink || '',
          reengagementRuleId: rule.id,
        },
      )

      const rows = batch.map((device, idx) => {
        const itemResp = response.responses[idx]
        const success = !!itemResp?.success
        if (success) sendCount += 1
        return {
          ruleId: rule.id,
          userId: device.userId,
          deviceId: device.deviceId,
          fcmToken: device.fcmToken,
          status: success ? 'sent' : 'failed',
          errorMessage: success ? null : (itemResp?.error?.message || itemResp?.error?.code || 'unknown_send_error'),
          sentAt: success ? now : null,
          updatedAt: now,
        }
      })

      await db
        .insert(notificationReengagementSends)
        .values(rows)
        .onConflictDoUpdate({
          target: [notificationReengagementSends.ruleId, notificationReengagementSends.deviceId],
          set: {
            fcmToken: sql`excluded.fcm_token`,
            status: sql`excluded.status`,
            errorMessage: sql`excluded.error_message`,
            sentAt: sql`excluded.sent_at`,
            updatedAt: sql`excluded.updated_at`,
          },
        })
    }
  }

  return sendCount
}

export async function sendReengagementRuleTest(rule, userId) {
  const devices = await db
    .select({
      userId: userDevices.userId,
      deviceId: userDevices.deviceId,
      fcmToken: userDevices.fcmToken,
    })
    .from(userDevices)
    .where(
      and(
        eq(userDevices.userId, userId),
        eq(userDevices.pushNotificationEnabled, true),
        sql`${userDevices.fcmToken} IS NOT NULL`,
        sql`length(trim(${userDevices.fcmToken})) > 0`,
      ),
    )
  if (!devices.length) return { ok: false, sent: 0 }

  let sent = 0
  for (const batch of chunkArray(devices, FCM_BATCH_SIZE)) {
    const tokens = batch.map((item) => item.fcmToken)
    const response = await sendPushNotificationDetailed(
      tokens,
      { title: rule.title, body: rule.body },
      {
        type: 'campaign',
        campaignId: '',
        deeplink: rule.deeplink || '',
        reengagementRuleId: rule.id,
      },
    )
    sent += response.successCount || 0
  }
  return { ok: true, sent }
}
