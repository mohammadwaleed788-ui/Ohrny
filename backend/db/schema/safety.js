import {
  pgTable, uuid, varchar, boolean, smallint, timestamp, text, index, uniqueIndex,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './users.js';
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
  reviewedAt:     timestamp('reviewed_at', { withTimezone: true }),
  resolutionNote: text('resolution_note'),

  createdAt:      timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:      timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  reporterIdx:    index('reports_reporter_idx').on(t.reporterId),
  reportedIdx:    index('reports_reported_idx').on(t.reportedId),
  statusIdx:      index('reports_status_idx').on(t.status),
  createdIdx:     index('reports_created_idx').on(t.createdAt),
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
}));
