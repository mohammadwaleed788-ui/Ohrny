import {
  pgTable, uuid, varchar, text, boolean,
  timestamp, index, uniqueIndex, smallint,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import {
  iamEnum, twoFaMethodEnum, planEnum, disguiseEnum,
  relationshipGoalEnum, relStatusEnum,
} from './enums.js';

// ─── users ────────────────────────────────────────────────────────────────────
// Central table. Every other table foreign-keys back here.
export const users = pgTable('users', {
  id:                   uuid('id').primaryKey().defaultRandom(),

  // ── Identity ───────────────────────────────────────────────────────────────
  handle:               varchar('handle', { length: 24 }).notNull().unique(),
  phone:                varchar('phone', { length: 20 }).notNull(),
  phoneCountry:         varchar('phone_country', { length: 6 }).notNull().default('+1'),
  phoneVerified:        boolean('phone_verified').notNull().default(false),
  twoFaMethod:          twoFaMethodEnum('two_fa_method'),

  // ── Profile basics ─────────────────────────────────────────────────────────
  age:                  smallint('age').notNull(),               // set at onboarding, immutable
  iam:                  iamEnum('iam').notNull(),
  iamOther:             varchar('iam_other', { length: 60 }),    // when iam = 'other'
  pronouns:             varchar('pronouns', { length: 40 }),     // e.g. she/they
  bio:                  text('bio'),
  aboutMe:              text('about_me'),
  looking:              varchar('looking', { length: 120 }),     // free-text goal line
  relationshipGoal:     relationshipGoalEnum('relationship_goal'),
  relStatus:            relStatusEnum('rel_status'),
  work:                 varchar('work', { length: 120 }),        // job + studio text
  orientation:          text('orientation').array().notNull().default(sql`'{}'::text[]`),
  // ^ multi-select: women / men / nonbinary / everyone

  // ── Location (approximate — rounded to ~1 km for privacy) ──────────────────
  city:                 varchar('city', { length: 100 }),
  countryCode:          varchar('country_code', { length: 4 }),
  latApprox:            varchar('lat_approx', { length: 12 }),   // stored as truncated string
  lngApprox:            varchar('lng_approx', { length: 12 }),
  locationGranted:      boolean('location_granted').notNull().default(false),
  searchRadius:         smallint('search_radius').notNull().default(25),   // miles
  minRadius:            smallint('min_radius').notNull().default(0),       // exclusion zone

  // ── Privacy / blur ─────────────────────────────────────────────────────────
  myBlur:               smallint('my_blur').notNull().default(70),  // 0-100

  // ── Verification ───────────────────────────────────────────────────────────
  idVerified:           boolean('id_verified').notNull().default(false),
  profileCompletePct:   smallint('profile_complete_pct').notNull().default(0),

  // ── Plan (mirrors RevenueCat entitlement, kept in sync via webhook) ─────────
  plan:                 planEnum('plan').notNull().default('free'),
  revenueCatUserId:     varchar('revenue_cat_user_id', { length: 120 }),

  // ── Daily caps (reset at midnight UTC) ─────────────────────────────────────
  swipesUsedToday:      smallint('swipes_used_today').notNull().default(0),
  swipesResetAt:        timestamp('swipes_reset_at', { withTimezone: true }),
  matchesStarted:       smallint('matches_started').notNull().default(0),

  // ── Inventory ──────────────────────────────────────────────────────────────
  superLikesLeft:       smallint('super_likes_left').notNull().default(0),
  boostsLeft:           smallint('boosts_left').notNull().default(0),

  // ── App disguise & panic ────────────────────────────────────────────────────
  disguise:             disguiseEnum('disguise').notNull().default('ohrny'),
  panicFabEnabled:      boolean('panic_fab_enabled').notNull().default(true),

  // ── Presence ───────────────────────────────────────────────────────────────
  // Last time the user had a live socket connection (or opened a chat). Shown as
  // "Active now / Last active Xm ago" to Platin viewers only.
  lastActiveAt:         timestamp('last_active_at', { withTimezone: true }),

  // ── Account state ──────────────────────────────────────────────────────────
  isBanned:             boolean('is_banned').notNull().default(false),
  bannedByAdminId:      uuid('banned_by_admin_id'),
  banReason:            text('ban_reason'),
  isPaused:             boolean('is_paused').notNull().default(false),
  pausedUntil:          timestamp('paused_until', { withTimezone: true }),
  deletedAt:            timestamp('deleted_at', { withTimezone: true }),  // soft delete

  language:             varchar('language', { length: 10 }).notNull().default('en'),

  createdAt:            timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:            timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  handleIdx:            index('users_handle_idx').on(t.handle),
  phoneCountryPhoneUniq: uniqueIndex('users_phone_country_phone_uniq').on(t.phoneCountry, t.phone),
  phoneIdx:             index('users_phone_idx').on(t.phone),
  planIdx:              index('users_plan_idx').on(t.plan),
  cityIdx:              index('users_city_idx').on(t.city),
}));

// ─── user_lifestyle ───────────────────────────────────────────────────────────
// One row per user. All nullable — filled in on edit profile.
export const userLifestyle = pgTable('user_lifestyle', {
  id:         uuid('id').primaryKey().defaultRandom(),
  userId:     uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }).unique(),

  height:     varchar('height', { length: 20 }),       // e.g. 5'7"
  drinks:     varchar('drinks', { length: 40 }),        // Socially / Never / etc.
  smokes:     varchar('smokes', { length: 40 }),        // Never / Sometimes / etc.
  kids:       varchar('kids', { length: 60 }),          // Want someday / Have some / etc.
  pets:       varchar('pets', { length: 60 }),          // One cat / Dog lover / etc.
  diet:       varchar('diet', { length: 60 }),          // Mostly veggie / Vegan / etc.
  exercise:   varchar('exercise', { length: 60 }),      // A few times a week / etc.
  religion:   varchar('religion', { length: 60 }),      // Spiritual / Atheist / etc.
  education:  varchar('education', { length: 60 }),     // Bachelor's / Master's / etc.
  zodiac:     varchar('zodiac', { length: 20 }),        // Libra / Scorpio / etc.

  updatedAt:  timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─── user_photos ──────────────────────────────────────────────────────────────
// Up to 6 photos per user. Position 1 = main/hero photo.
export const userPhotos = pgTable('user_photos', {
  id:           uuid('id').primaryKey().defaultRandom(),
  userId:       uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),

  position:     smallint('position').notNull(),          // 1–6
  storageKey:   varchar('storage_key', { length: 512 }).notNull(),  // S3 / CDN path
  blurAmount:   smallint('blur_amount').notNull().default(70),      // 0-100
  isBlurred:    boolean('is_blurred').notNull().default(true),
  isMain:       boolean('is_main').notNull().default(false),        // position === 1

  createdAt:    timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt:    timestamp('deleted_at', { withTimezone: true }),
}, (t) => ({
  userPosUniq:  uniqueIndex('user_photos_user_pos_idx').on(t.userId, t.position),
  userIdx:      index('user_photos_user_idx').on(t.userId),
}));

// ─── user_prompts ─────────────────────────────────────────────────────────────
// Up to 3 prompts per user. Examples: "A PERFECT SUNDAY", "NON-NEGOTIABLES".
export const userPrompts = pgTable('user_prompts', {
  id:         uuid('id').primaryKey().defaultRandom(),
  userId:     uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),

  position:   smallint('position').notNull(),             // 1–3; display order
  title:      varchar('title', { length: 80 }).notNull(), // e.g. "THE WAY TO MY HEART"
  answer:     text('answer').notNull(),

  updatedAt:  timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  userPosUniq: uniqueIndex('user_prompts_user_pos_idx').on(t.userId, t.position),
  userIdx:     index('user_prompts_user_idx').on(t.userId),
}));

// ─── user_interests ───────────────────────────────────────────────────────────
// Chip tags shown on profile: "Bookstores", "Slow coffee", "Architecture", etc.
export const userInterests = pgTable('user_interests', {
  id:        uuid('id').primaryKey().defaultRandom(),
  userId:    uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  interest:  varchar('interest', { length: 60 }).notNull(),
  position:  smallint('position').notNull().default(0),   // display order
}, (t) => ({
  userIdx:   index('user_interests_user_idx').on(t.userId),
}));

// ─── Relations ────────────────────────────────────────────────────────────────
export const usersRelations = relations(users, ({ one, many }) => ({
  lifestyle:          one(userLifestyle, { fields: [users.id], references: [userLifestyle.userId] }),
  photos:             many(userPhotos),
  prompts:            many(userPrompts),
  interests:          many(userInterests),
}));

export const userLifestyleRelations = relations(userLifestyle, ({ one }) => ({
  user: one(users, { fields: [userLifestyle.userId], references: [users.id] }),
}));

export const userPhotosRelations = relations(userPhotos, ({ one }) => ({
  user: one(users, { fields: [userPhotos.userId], references: [users.id] }),
}));

export const userPromptsRelations = relations(userPrompts, ({ one }) => ({
  user: one(users, { fields: [userPrompts.userId], references: [users.id] }),
}));

export const userInterestsRelations = relations(userInterests, ({ one }) => ({
  user: one(users, { fields: [userInterests.userId], references: [users.id] }),
}));

