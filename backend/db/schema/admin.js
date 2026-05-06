import {
  pgTable, uuid, varchar, boolean, timestamp,
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

// ─── Relations ────────────────────────────────────────────────────────────────
export const adminUsersRelations = relations(adminUsers, () => ({}));

