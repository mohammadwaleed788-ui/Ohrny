import {
  pgTable, uuid, boolean, smallint, timestamp, index, uniqueIndex,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './users.js';
import { likeTypeEnum } from './enums.js';

// ─── likes ────────────────────────────────────────────────────────────────────
// Tracks every swipe action. A mutual 'like' creates a row in matches.
// 'pass' swipes are also stored so the same profile isn't shown again.
export const likes = pgTable('likes', {
  id:           uuid('id').primaryKey().defaultRandom(),
  fromUserId:   uuid('from_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  toUserId:     uuid('to_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type:         likeTypeEnum('type').notNull(),   // like | super_like | pass

  // If this like completed a mutual match, point to that match row.
  matchId:      uuid('match_id'),
  seenAt:       timestamp('seen_at', { withTimezone: true }),

  createdAt:    timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uniquePair:     uniqueIndex('likes_pair_uniq').on(t.fromUserId, t.toUserId),
  toUserIdx:      index('likes_to_user_idx').on(t.toUserId),
  fromUserIdx:    index('likes_from_user_idx').on(t.fromUserId),
  typeIdx:        index('likes_type_idx').on(t.type),
}));

// ─── matches ──────────────────────────────────────────────────────────────────
// Created when userA likes userB AND userB likes userA (any order).
// userA is always the alphabetically-smaller id to prevent duplicate rows.
export const matches = pgTable('matches', {
  id:                     uuid('id').primaryKey().defaultRandom(),

  // userAId < userBId (enforced at insert time) prevents duplicate match rows.
  userAId:                uuid('user_a_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  userBId:                uuid('user_b_id').notNull().references(() => users.id, { onDelete: 'cascade' }),

  matchedAt:              timestamp('matched_at', { withTimezone: true }).notNull().defaultNow(),

  // ── Photo unlock ───────────────────────────────────────────────────────────
  userAUnlockRequested:   boolean('user_a_unlock_requested').notNull().default(false),
  userBUnlockRequested:   boolean('user_b_unlock_requested').notNull().default(false),
  photosUnlocked:         boolean('photos_unlocked').notNull().default(false),
  photosUnlockedAt:       timestamp('photos_unlocked_at', { withTimezone: true }),

  // ── Chat state ─────────────────────────────────────────────────────────────
  messageCountUserA:      smallint('message_count_user_a').notNull().default(0),
  messageCountUserB:      smallint('message_count_user_b').notNull().default(0),

  // ── "New match" badge ────────────────────────────────────────────────────
  // Per-user flag: false while the match is still NEW to that user (drives the
  // "Your Likes" badge + bottom-nav dot). Set true once they open the matched
  // card. The initiator of a like-back/swipe-match is marked seen immediately.
  userASeenMatch:         boolean('user_a_seen_match').notNull().default(false),
  userBSeenMatch:         boolean('user_b_seen_match').notNull().default(false),

  // ── Lifecycle ──────────────────────────────────────────────────────────────  
  isActive:               boolean('is_active').notNull().default(true),
  unmatchedAt:            timestamp('unmatched_at', { withTimezone: true }),
  unmatchedByUserId:      uuid('unmatched_by_user_id').references(() => users.id),

  createdAt:              timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:              timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uniquePair:   uniqueIndex('matches_pair_uniq').on(t.userAId, t.userBId),
  userAIdx:     index('matches_user_a_idx').on(t.userAId),
  userBIdx:     index('matches_user_b_idx').on(t.userBId),
  activeIdx:    index('matches_active_idx').on(t.isActive),
}));

// ─── Relations ────────────────────────────────────────────────────────────────
export const likesRelations = relations(likes, ({ one }) => ({
  fromUser: one(users, { fields: [likes.fromUserId], references: [users.id], relationName: 'sentLikes' }),
  toUser:   one(users, { fields: [likes.toUserId],   references: [users.id], relationName: 'receivedLikes' }),
  match:    one(matches, { fields: [likes.matchId],  references: [matches.id] }),
}));

export const matchesRelations = relations(matches, ({ one, many }) => ({
  userA:          one(users, { fields: [matches.userAId], references: [users.id], relationName: 'matchesAsA' }),
  userB:          one(users, { fields: [matches.userBId], references: [users.id], relationName: 'matchesAsB' }),
  unmatchedBy:    one(users, { fields: [matches.unmatchedByUserId], references: [users.id], relationName: 'unmatchedMatches' }),
}));
