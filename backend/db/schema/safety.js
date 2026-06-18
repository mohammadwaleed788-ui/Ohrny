import {
  pgTable, uuid, varchar, boolean, smallint, timestamp, text, index, uniqueIndex,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './users.js';
import { adminUsers } from './admin.js';
import { reportReasonEnum, reportStatusEnum } from './enums.js';

// ─── blocks ───────────────────────────────────────────────────────────────────
// A block hides both users from each other's deck and ends any active match.
export const blocks = pgTable('blocks', {
  id:           uuid('id').primaryKey().defaultRandom(),
  blockerId:    uuid('blocker_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  blockedId:    uuid('blocked_id').notNull().references(() => users.id, { onDelete: 'cascade' }),

  createdAt:    timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uniquePair:   uniqueIndex('blocks_pair_uniq').on(t.blockerId, t.blockedId),
  blockerIdx:   index('blocks_blocker_idx').on(t.blockerId),
  blockedIdx:   index('blocks_blocked_idx').on(t.blockedId),
}));

// ─── reports ──────────────────────────────────────────────────────────────────
// User safety reports reviewed in the admin panel.
export const reports = pgTable('reports', {
  id:             uuid('id').primaryKey().defaultRandom(),
  reporterId:     uuid('reporter_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  reportedId:     uuid('reported_id').notNull().references(() => users.id, { onDelete: 'cascade' }),

  reason:         reportReasonEnum('reason').notNull(),

  details:        text('details'),

  status:         reportStatusEnum('status').notNull().default('pending'),

  // ── Admin resolution ──────────────────────────────────────────────────────
  reviewedByAdminId:  uuid('reviewed_by_admin_id'),
  assignedToAdminId:  uuid('assigned_to_admin_id'),
  assignedAt:         timestamp('assigned_at', { withTimezone: true }),
  enforcementId:      uuid('enforcement_id'),
  reviewedAt:     timestamp('reviewed_at', { withTimezone: true }),
  resolutionNote: text('resolution_note'),

  createdAt:      timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:      timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  reporterIdx:    index('reports_reporter_idx').on(t.reporterId),
  reportedIdx:    index('reports_reported_idx').on(t.reportedId),
  statusIdx:      index('reports_status_idx').on(t.status),
  createdIdx:     index('reports_created_idx').on(t.createdAt),
  assignedAdminIdx: index('reports_assigned_admin_idx').on(t.assignedToAdminId),
  reviewedAdminIdx: index('reports_reviewed_admin_idx').on(t.reviewedByAdminId),
}));

// ─── user_enforcements ───────────────────────────────────────────────────────
export const userEnforcements = pgTable('user_enforcements', {
  id:               uuid('id').primaryKey().defaultRandom(),
  userId:           uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  reportId:         uuid('report_id').references(() => reports.id, { onDelete: 'set null' }),
  action:           varchar('action', { length: 32 }).notNull(), // hard_ban | timed_pause | unban
  reason:           text('reason'),
  note:             text('note'),
  active:           boolean('active').notNull().default(true),
  startsAt:         timestamp('starts_at', { withTimezone: true }).notNull().defaultNow(),
  endsAt:           timestamp('ends_at', { withTimezone: true }),
  createdByAdminId: uuid('created_by_admin_id').references(() => adminUsers.id, { onDelete: 'set null' }),
  createdAt:        timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:        timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  userIdx:          index('user_enforcements_user_idx').on(t.userId),
  reportIdx:        index('user_enforcements_report_idx').on(t.reportId),
  activeIdx:        index('user_enforcements_active_idx').on(t.active),
  createdIdx:       index('user_enforcements_created_idx').on(t.createdAt),
  createdByIdx:     index('user_enforcements_created_by_idx').on(t.createdByAdminId),
}));

// ─── appeals ─────────────────────────────────────────────────────────────────
export const appeals = pgTable('appeals', {
  id:               uuid('id').primaryKey().defaultRandom(),
  enforcementId:    uuid('enforcement_id').notNull().references(() => userEnforcements.id, { onDelete: 'cascade' }),
  userId:           uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  statement:        text('statement').notNull(),
  status:           varchar('status', { length: 24 }).notNull().default('open'),
  decision:         varchar('decision', { length: 24 }),
  decisionNote:     text('decision_note'),
  decidedByAdminId: uuid('decided_by_admin_id').references(() => adminUsers.id, { onDelete: 'set null' }),
  decidedAt:        timestamp('decided_at', { withTimezone: true }),
  createdAt:        timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:        timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  enforcementIdx:   index('appeals_enforcement_idx').on(t.enforcementId),
  userIdx:          index('appeals_user_idx').on(t.userId),
  statusIdx:        index('appeals_status_idx').on(t.status),
  createdIdx:       index('appeals_created_idx').on(t.createdAt),
}));

// ─── phone_verifications ─────────────────────────────────────────────────────
// Short-lived rows for SMS OTP flows (sign-in and onboarding).
export const phoneVerifications = pgTable('phone_verifications', {
  id:           uuid('id').primaryKey().defaultRandom(),
  phone:        varchar('phone', { length: 20 }).notNull(),
  phoneCountry: varchar('phone_country', { length: 6 }).notNull().default('+1'),

  codeHash:     varchar('code_hash', { length: 128 }).notNull(),

  attempts:     smallint('attempts').notNull().default(0),

  verified:     boolean('verified').notNull().default(false),
  expiresAt:    timestamp('expires_at', { withTimezone: true }).notNull(),

  createdAt:    timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  phoneIdx:     index('phone_verifications_phone_idx').on(t.phone),
  expiresIdx:   index('phone_verifications_expires_idx').on(t.expiresAt),
}));

// ─── Relations ────────────────────────────────────────────────────────────────
export const blocksRelations = relations(blocks, ({ one }) => ({
  blocker: one(users, { fields: [blocks.blockerId], references: [users.id], relationName: 'sentBlocks' }),
  blocked: one(users, { fields: [blocks.blockedId], references: [users.id], relationName: 'receivedBlocks' }),
}));

export const reportsRelations = relations(reports, ({ one }) => ({
  reporter: one(users, { fields: [reports.reporterId], references: [users.id], relationName: 'sentReports' }),
  reported: one(users, { fields: [reports.reportedId], references: [users.id], relationName: 'receivedReports' }),
  assignedAdmin: one(adminUsers, { fields: [reports.assignedToAdminId], references: [adminUsers.id], relationName: 'assignedReports' }),
  reviewedAdmin: one(adminUsers, { fields: [reports.reviewedByAdminId], references: [adminUsers.id], relationName: 'reviewedReports' }),
  enforcement: one(userEnforcements, { fields: [reports.enforcementId], references: [userEnforcements.id] }),
}));

export const userEnforcementsRelations = relations(userEnforcements, ({ one, many }) => ({
  user: one(users, { fields: [userEnforcements.userId], references: [users.id] }),
  report: one(reports, { fields: [userEnforcements.reportId], references: [reports.id] }),
  admin: one(adminUsers, { fields: [userEnforcements.createdByAdminId], references: [adminUsers.id], relationName: 'createdEnforcements' }),
  appeals: many(appeals),
}));

export const appealsRelations = relations(appeals, ({ one }) => ({
  enforcement: one(userEnforcements, { fields: [appeals.enforcementId], references: [userEnforcements.id] }),
  user: one(users, { fields: [appeals.userId], references: [users.id] }),
  decidedBy: one(adminUsers, { fields: [appeals.decidedByAdminId], references: [adminUsers.id], relationName: 'decidedAppeals' }),
}));

