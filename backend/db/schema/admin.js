import {
  pgTable, uuid, varchar, boolean, timestamp, text, jsonb, index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { adminRoleEnum } from './enums.js';

// ─── admin_users ──────────────────────────────────────────────────────────────
// Internal staff accounts for the admin panel only.
// Completely separate from the users table (no FK to users).
export const adminUsers = pgTable('admin_users', {
  id:             uuid('id').primaryKey().defaultRandom(),

  email:          varchar('email', { length: 255 }).notNull().unique(),
  passwordHash:   varchar('password_hash', { length: 255 }).notNull(),

  name:           varchar('name', { length: 80 }).notNull(),
  role:           adminRoleEnum('role').notNull().default('support'),

  isActive:       boolean('is_active').notNull().default(true),

  // ── 2-FA for admin panel ──────────────────────────────────────────────────
  totpSecret:     varchar('totp_secret', { length: 64 }),
  totpEnabled:    boolean('totp_enabled').notNull().default(false),

  lastLoginAt:    timestamp('last_login_at', { withTimezone: true }),
  lastLoginIp:    varchar('last_login_ip', { length: 45 }),

  createdAt:      timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:      timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─── admin_audit_logs ─────────────────────────────────────────────────────────
// Immutable log of every admin action. Rows are never updated or deleted.
export const adminAuditLogs = pgTable('admin_audit_logs', {
  id:           uuid('id').primaryKey().defaultRandom(),
  adminId:      uuid('admin_id').notNull().references(() => adminUsers.id),

  action:       varchar('action', { length: 80 }).notNull(),

  targetType:   varchar('target_type', { length: 40 }),
  targetId:     uuid('target_id'),

  previousState: jsonb('previous_state'),
  newState:     jsonb('new_state'),

  ipAddress:    varchar('ip_address', { length: 45 }),
  userAgent:    text('user_agent'),

  createdAt:    timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  adminIdx:     index('audit_logs_admin_idx').on(t.adminId),
  targetIdx:    index('audit_logs_target_idx').on(t.targetType, t.targetId),
  createdIdx:   index('audit_logs_created_idx').on(t.createdAt),
}));

// ─── admin_sessions ───────────────────────────────────────────────────────────
// Short-lived JWT refresh tokens for the admin panel.
export const adminSessions = pgTable('admin_sessions', {
  id:           uuid('id').primaryKey().defaultRandom(),
  adminId:      uuid('admin_id').notNull().references(() => adminUsers.id, { onDelete: 'cascade' }),

  tokenHash:    varchar('token_hash', { length: 128 }).notNull().unique(),

  ipAddress:    varchar('ip_address', { length: 45 }),
  userAgent:    text('user_agent'),

  expiresAt:    timestamp('expires_at', { withTimezone: true }).notNull(),
  revokedAt:    timestamp('revoked_at', { withTimezone: true }),

  createdAt:    timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  adminIdx:     index('admin_sessions_admin_idx').on(t.adminId),
  expiresIdx:   index('admin_sessions_expires_idx').on(t.expiresAt),
}));

// ─── Relations ────────────────────────────────────────────────────────────────
export const adminUsersRelations = relations(adminUsers, ({ many }) => ({
  auditLogs: many(adminAuditLogs),
  sessions:  many(adminSessions),
}));

export const adminAuditLogsRelations = relations(adminAuditLogs, ({ one }) => ({
  admin: one(adminUsers, { fields: [adminAuditLogs.adminId], references: [adminUsers.id] }),
}));

export const adminSessionsRelations = relations(adminSessions, ({ one }) => ({
  admin: one(adminUsers, { fields: [adminSessions.adminId], references: [adminUsers.id] }),
}));
