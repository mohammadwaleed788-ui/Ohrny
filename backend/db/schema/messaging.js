import {
  pgTable, uuid, text, boolean, integer, timestamp, index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './users.js';
import { matches } from './matching.js';
import { callTypeEnum, callStatusEnum } from './enums.js';

// ─── messages ────────────────────────────────────────────────────────────────
// All chat messages within a match. Ephemeral rows are hard-deleted by a
// nightly job when expires_at passes (or immediately on app wipe).
export const messages = pgTable('messages', {
  id:           uuid('id').primaryKey().defaultRandom(),
  matchId:      uuid('match_id').notNull().references(() => matches.id, { onDelete: 'cascade' }),
  senderId:     uuid('sender_id').notNull().references(() => users.id, { onDelete: 'cascade' }),

  content:      text('content').notNull(),

  // ── Read receipts (Ohrny Platin only) ─────────────────────────────────────
  isRead:       boolean('is_read').notNull().default(false),
  readAt:       timestamp('read_at', { withTimezone: true }),

  // ── Ephemeral settings ────────────────────────────────────────────────────
  isEphemeral:  boolean('is_ephemeral').notNull().default(true),
  expiresAt:    timestamp('expires_at', { withTimezone: true }),

  createdAt:    timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt:    timestamp('deleted_at', { withTimezone: true }),
  // ── Per-user hiding ───────────────────────────────────────────────────────
  // When set, the message is hidden ONLY for this user (the one who chose
  // "Delete for me"). The other participant still sees it. For
  // "Delete for everyone" we use deletedAt instead.
  deletedForUserId: uuid('deleted_for_user_id').references(() => users.id, { onDelete: 'cascade' }),
}, (t) => ({
  matchIdx:     index('messages_match_idx').on(t.matchId),
  senderIdx:    index('messages_sender_idx').on(t.senderId),
  expiresIdx:   index('messages_expires_idx').on(t.expiresAt),
  deletedForIdx: index('messages_deleted_for_idx').on(t.deletedForUserId),
}));

// ─── calls ────────────────────────────────────────────────────────────────────
// Voice and video call records within a match.
export const calls = pgTable('calls', {
  id:               uuid('id').primaryKey().defaultRandom(),
  matchId:          uuid('match_id').notNull().references(() => matches.id, { onDelete: 'cascade' }),
  callerId:         uuid('caller_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  calleeId:         uuid('callee_id').notNull().references(() => users.id, { onDelete: 'cascade' }),

  type:             callTypeEnum('type').notNull(),     // voice | video
  status:           callStatusEnum('status').notNull().default('initiated'),

  // ── Privacy features ──────────────────────────────────────────────────────
  voiceMasked:      boolean('voice_masked').notNull().default(true),
  callerSelfieBlurred: boolean('caller_selfie_blurred').notNull().default(true),

  // ── Timing ────────────────────────────────────────────────────────────────
  startedAt:        timestamp('started_at', { withTimezone: true }),
  endedAt:          timestamp('ended_at', { withTimezone: true }),
  durationSeconds:  integer('duration_seconds'),

  createdAt:        timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  matchIdx:   index('calls_match_idx').on(t.matchId),
  callerIdx:  index('calls_caller_idx').on(t.callerId),
  calleeIdx:  index('calls_callee_idx').on(t.calleeId),
}));

// ─── Relations ────────────────────────────────────────────────────────────────
export const messagesRelations = relations(messages, ({ one }) => ({
  match:  one(matches, { fields: [messages.matchId],  references: [matches.id] }),
  sender: one(users,   { fields: [messages.senderId], references: [users.id] }),
}));

export const callsRelations = relations(calls, ({ one }) => ({
  match:  one(matches, { fields: [calls.matchId],  references: [matches.id] }),
  caller: one(users,   { fields: [calls.callerId], references: [users.id], relationName: 'outboundCalls' }),
  callee: one(users,   { fields: [calls.calleeId], references: [users.id], relationName: 'inboundCalls' }),
}));
