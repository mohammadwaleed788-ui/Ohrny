import {
  pgTable, uuid, varchar, text, timestamp, integer, index, uniqueIndex, boolean,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './users.js';
import { adminUsers } from './admin.js';

export const notificationCampaigns = pgTable('notification_campaigns', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 160 }).notNull(),
  title: varchar('title', { length: 160 }).notNull(),
  body: text('body').notNull(),
  deeplink: varchar('deeplink', { length: 512 }),
  channel: varchar('channel', { length: 20 }).notNull().default('push'),
  audienceType: varchar('audience_type', { length: 40 }).notNull().default('all_users'),
  status: varchar('status', { length: 24 }).notNull().default('draft'),
  sendMode: varchar('send_mode', { length: 20 }).notNull().default('draft'),
  scheduledAt: timestamp('scheduled_at', { withTimezone: true }),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  totalTargets: integer('total_targets').notNull().default(0),
  totalSent: integer('total_sent').notNull().default(0),
  totalFailed: integer('total_failed').notNull().default(0),
  lastError: text('last_error'),
  createdByAdminId: uuid('created_by_admin_id').references(() => adminUsers.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  statusIdx: index('notif_campaign_status_idx').on(t.status, t.scheduledAt),
  createdAtIdx: index('notif_campaign_created_idx').on(t.createdAt),
}));

export const notificationCampaignTargets = pgTable('notification_campaign_targets', {
  id: uuid('id').defaultRandom().primaryKey(),
  campaignId: uuid('campaign_id')
    .notNull()
    .references(() => notificationCampaigns.id, { onDelete: 'cascade' }),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  campaignIdx: index('notif_campaign_targets_campaign_idx').on(t.campaignId),
  userIdx: index('notif_campaign_targets_user_idx').on(t.userId),
  campaignUserUniq: uniqueIndex('notif_campaign_targets_campaign_user_uniq').on(t.campaignId, t.userId),
}));

export const notificationCampaignDeliveries = pgTable('notification_campaign_deliveries', {
  id: uuid('id').defaultRandom().primaryKey(),
  campaignId: uuid('campaign_id')
    .notNull()
    .references(() => notificationCampaigns.id, { onDelete: 'cascade' }),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  deviceId: varchar('device_id', { length: 255 }).notNull(),
  fcmToken: text('fcm_token'),
  status: varchar('status', { length: 24 }).notNull(),
  errorMessage: text('error_message'),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  campaignIdx: index('notif_campaign_deliveries_campaign_idx').on(t.campaignId),
  statusIdx: index('notif_campaign_deliveries_status_idx').on(t.status),
  campaignDeviceUniq: uniqueIndex('notif_campaign_deliveries_campaign_device_uniq').on(t.campaignId, t.deviceId),
}));

export const notificationCampaignsRelations = relations(notificationCampaigns, ({ one, many }) => ({
  createdBy: one(adminUsers, {
    fields: [notificationCampaigns.createdByAdminId],
    references: [adminUsers.id],
  }),
  targets: many(notificationCampaignTargets),
  deliveries: many(notificationCampaignDeliveries),
}));

export const notificationCampaignTargetsRelations = relations(notificationCampaignTargets, ({ one }) => ({
  campaign: one(notificationCampaigns, {
    fields: [notificationCampaignTargets.campaignId],
    references: [notificationCampaigns.id],
  }),
  user: one(users, {
    fields: [notificationCampaignTargets.userId],
    references: [users.id],
  }),
}));

export const notificationCampaignDeliveriesRelations = relations(notificationCampaignDeliveries, ({ one }) => ({
  campaign: one(notificationCampaigns, {
    fields: [notificationCampaignDeliveries.campaignId],
    references: [notificationCampaigns.id],
  }),
  user: one(users, {
    fields: [notificationCampaignDeliveries.userId],
    references: [users.id],
  }),
}));

export const notificationReengagementRules = pgTable('notification_reengagement_rules', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 120 }).notNull(),
  title: varchar('title', { length: 160 }).notNull(),
  body: text('body').notNull(),
  deeplink: varchar('deeplink', { length: 512 }),
  inactiveDays: integer('inactive_days').notNull().default(7),
  isEnabled: boolean('is_enabled').notNull().default(true),
  updatedByAdminId: uuid('updated_by_admin_id').references(() => adminUsers.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  enabledIdx: index('notif_reengage_enabled_idx').on(t.isEnabled, t.inactiveDays),
}));

export const notificationReengagementSends = pgTable('notification_reengagement_sends', {
  id: uuid('id').defaultRandom().primaryKey(),
  ruleId: uuid('rule_id')
    .notNull()
    .references(() => notificationReengagementRules.id, { onDelete: 'cascade' }),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  deviceId: varchar('device_id', { length: 255 }).notNull(),
  fcmToken: text('fcm_token'),
  status: varchar('status', { length: 24 }).notNull(),
  errorMessage: text('error_message'),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  ruleIdx: index('notif_reengage_sends_rule_idx').on(t.ruleId, t.createdAt),
  ruleUserIdx: index('notif_reengage_sends_rule_user_idx').on(t.ruleId, t.userId),
  ruleDeviceUniq: uniqueIndex('notif_reengage_sends_rule_device_uniq').on(t.ruleId, t.deviceId),
}));

export const notificationReengagementRulesRelations = relations(notificationReengagementRules, ({ one, many }) => ({
  updatedBy: one(adminUsers, {
    fields: [notificationReengagementRules.updatedByAdminId],
    references: [adminUsers.id],
  }),
  sends: many(notificationReengagementSends),
}));

export const notificationReengagementSendsRelations = relations(notificationReengagementSends, ({ one }) => ({
  rule: one(notificationReengagementRules, {
    fields: [notificationReengagementSends.ruleId],
    references: [notificationReengagementRules.id],
  }),
  user: one(users, {
    fields: [notificationReengagementSends.userId],
    references: [users.id],
  }),
}));
