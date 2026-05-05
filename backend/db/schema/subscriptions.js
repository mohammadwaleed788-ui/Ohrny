import {
  pgTable, uuid, varchar, boolean, smallint, integer,
  numeric, timestamp, jsonb, index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './users.js';
import {
  planEnum, subscriptionStatusEnum, platformEnum, purchaseTypeEnum,
} from './enums.js';

// ─── subscription_plans ───────────────────────────────────────────────────────
// Static seed data — one row per plan tier. Updated by admin when pricing changes.
export const subscriptionPlans = pgTable('subscription_plans', {
  id:                   varchar('id', { length: 20 }).primaryKey(),

  name:                 varchar('name', { length: 40 }).notNull(),
  priceMonthly:         numeric('price_monthly', { precision: 8, scale: 2 }),
  currency:             varchar('currency', { length: 4 }).notNull().default('EUR'),

  // ── RevenueCat product IDs (set per platform in admin) ────────────────────
  revenueCatProductIdIos:     varchar('revenue_cat_product_id_ios',     { length: 120 }),
  revenueCatProductIdAndroid: varchar('revenue_cat_product_id_android', { length: 120 }),

  // ── Feature flags ─────────────────────────────────────────────────────────
  swipesPerDay:         smallint('swipes_per_day'),
  maxChats:             smallint('max_chats'),
  maxMessagesPerChat:   smallint('max_messages_per_chat'),
  superLikesPerWeek:    smallint('super_likes_per_week').notNull().default(0),
  canSeeLikes:          boolean('can_see_likes').notNull().default(false),
  incognitoMode:        boolean('incognito_mode').notNull().default(false),
  priorityLikes:        boolean('priority_likes').notNull().default(false),
  readReceipts:         boolean('read_receipts').notNull().default(false),
  weeklyBoost:          boolean('weekly_boost').notNull().default(false),
  vaultFeature:         boolean('vault_feature').notNull().default(false),
  concierge:            boolean('concierge').notNull().default(false),
  travelMode:           boolean('travel_mode').notNull().default(false),
  advancedCompatibility: boolean('advanced_compatibility').notNull().default(false),
  globalMode:           boolean('global_mode').notNull().default(false),

  featuresJson:         jsonb('features_json').notNull().default('[]'),

  isActive:             boolean('is_active').notNull().default(true),
  sortOrder:            smallint('sort_order').notNull().default(0),

  createdAt:            timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:            timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─── user_subscriptions ───────────────────────────────────────────────────────
// One active row per user (status = 'active'). Historical rows kept for billing.
export const userSubscriptions = pgTable('user_subscriptions', {
  id:                     uuid('id').primaryKey().defaultRandom(),
  userId:                 uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  planId:                 varchar('plan_id', { length: 20 }).notNull().references(() => subscriptionPlans.id),

  revenueCatPurchaseToken:  varchar('revenue_cat_purchase_token',  { length: 512 }),
  revenueCatEntitlementId:  varchar('revenue_cat_entitlement_id',  { length: 120 }),
  revenueCatTransactionId:  varchar('revenue_cat_transaction_id',  { length: 120 }),

  status:                 subscriptionStatusEnum('status').notNull().default('pending'),
  platform:               platformEnum('platform').notNull(),
  priceAtPurchase:        numeric('price_at_purchase', { precision: 8, scale: 2 }),
  currency:               varchar('currency', { length: 4 }).notNull().default('EUR'),

  startedAt:              timestamp('started_at',   { withTimezone: true }).notNull().defaultNow(),
  expiresAt:              timestamp('expires_at',   { withTimezone: true }),
  cancelledAt:            timestamp('cancelled_at', { withTimezone: true }),
  gracePeriodEndsAt:      timestamp('grace_period_ends_at', { withTimezone: true }),

  rawWebhookPayload:      jsonb('raw_webhook_payload'),

  createdAt:              timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:              timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  userIdx:    index('user_subscriptions_user_idx').on(t.userId),
  statusIdx:  index('user_subscriptions_status_idx').on(t.status),
  expiresIdx: index('user_subscriptions_expires_idx').on(t.expiresAt),
}));

// ─── in_app_purchases ────────────────────────────────────────────────────────
// One-time consumable packs: Super Likes and Boosts.
export const inAppPurchases = pgTable('in_app_purchases', {
  id:                       uuid('id').primaryKey().defaultRandom(),
  userId:                   uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),

  type:                     purchaseTypeEnum('type').notNull(),
  quantity:                 smallint('quantity').notNull(),

  priceAtPurchase:          numeric('price_at_purchase', { precision: 8, scale: 2 }).notNull(),
  currency:                 varchar('currency', { length: 4 }).notNull().default('EUR'),

  revenueCatProductId:      varchar('revenue_cat_product_id',      { length: 120 }),
  revenueCatTransactionId:  varchar('revenue_cat_transaction_id',  { length: 120 }).unique(),
  platform:                 platformEnum('platform').notNull(),

  purchasedAt:              timestamp('purchased_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  userIdx: index('in_app_purchases_user_idx').on(t.userId),
  typeIdx: index('in_app_purchases_type_idx').on(t.type),
}));

// ─── user_boosts ──────────────────────────────────────────────────────────────
// An active boost raises the user's profile in the discover deck for 30 min.
export const userBoosts = pgTable('user_boosts', {
  id:           uuid('id').primaryKey().defaultRandom(),
  userId:       uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),

  startedAt:    timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt:    timestamp('expires_at', { withTimezone: true }).notNull(),

  isActive:     boolean('is_active').notNull().default(true),
  isFreeWeekly: boolean('is_free_weekly').notNull().default(false),

  createdAt:    timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  userIdx:      index('user_boosts_user_idx').on(t.userId),
  activeIdx:    index('user_boosts_active_idx').on(t.isActive, t.expiresAt),
}));

// ─── Relations ────────────────────────────────────────────────────────────────
export const subscriptionPlansRelations = relations(subscriptionPlans, ({ many }) => ({
  userSubscriptions: many(userSubscriptions),
}));

export const userSubscriptionsRelations = relations(userSubscriptions, ({ one }) => ({
  user: one(users, { fields: [userSubscriptions.userId], references: [users.id] }),
  plan: one(subscriptionPlans, { fields: [userSubscriptions.planId], references: [subscriptionPlans.id] }),
}));

export const inAppPurchasesRelations = relations(inAppPurchases, ({ one }) => ({
  user: one(users, { fields: [inAppPurchases.userId], references: [users.id] }),
}));

export const userBoostsRelations = relations(userBoosts, ({ one }) => ({
  user: one(users, { fields: [userBoosts.userId], references: [users.id] }),
}));
