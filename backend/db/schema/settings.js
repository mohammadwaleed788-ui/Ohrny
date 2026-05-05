import {
  pgTable, uuid, boolean, smallint, timestamp, index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './users.js';
import { discoverRelTypeEnum } from './enums.js';

// ─── user_privacy_settings ────────────────────────────────────────────────────
// One row per user. Controls privacy toggles shown in Settings screen.
export const userPrivacySettings = pgTable('user_privacy_settings', {
  id:                     uuid('id').primaryKey().defaultRandom(),
  userId:                 uuid('user_id')
                            .notNull()
                            .references(() => users.id, { onDelete: 'cascade' })
                            .unique(),

  // ── Privacy toggles (Settings screen) ────────────────────────────────────
  blurPhotos:             boolean('blur_photos').notNull().default(true),
  anonymousHandle:        boolean('anonymous_handle').notNull().default(true),
  ephemeralMessages:      boolean('ephemeral_messages').notNull().default(true),
  screenshotShield:       boolean('screenshot_shield').notNull().default(true),
  incognitoMode:          boolean('incognito_mode').notNull().default(false),

  // ── Privacy preferences (cookie / data sheet) ─────────────────────────────
  analyticsConsent:       boolean('analytics_consent').notNull().default(true),
  personalizationConsent: boolean('personalization_consent').notNull().default(true),
  marketingEmails:        boolean('marketing_emails').notNull().default(false),
  thirdPartyMeasurement:  boolean('third_party_measurement').notNull().default(false),

  updatedAt:              timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─── user_discover_preferences ────────────────────────────────────────────────
// One row per user. Controls the "Dating Preferences" screen filters.
export const userDiscoverPreferences = pgTable('user_discover_preferences', {
  id:                     uuid('id').primaryKey().defaultRandom(),
  userId:                 uuid('user_id')
                            .notNull()
                            .references(() => users.id, { onDelete: 'cascade' })
                            .unique(),

  // ── Distance filters ──────────────────────────────────────────────────────
  maxDistance:            smallint('max_distance').notNull().default(25),
  minDistance:            smallint('min_distance').notNull().default(0),

  // ── Age filter ────────────────────────────────────────────────────────────
  ageMin:                 smallint('age_min').notNull().default(18),
  ageMax:                 smallint('age_max').notNull().default(70),

  // ── Relationship type filter ───────────────────────────────────────────────
  relationshipType:       discoverRelTypeEnum('relationship_type').notNull().default('dating'),

  // ── Photo visibility (how blurred my own photos appear to others in discover)
  photoBlurVisibility:    smallint('photo_blur_visibility').notNull().default(70),

  // ── Ohrny Plus filters (gated) ────────────────────────────────────────────
  verifiedOnly:           boolean('verified_only').notNull().default(false),
  advancedCompatibility:  boolean('advanced_compatibility').notNull().default(false),
  travelMode:             boolean('travel_mode').notNull().default(false),
  globalMode:             boolean('global_mode').notNull().default(false),

  updatedAt:              timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─── Relations ────────────────────────────────────────────────────────────────
export const userPrivacySettingsRelations = relations(userPrivacySettings, ({ one }) => ({
  user: one(users, { fields: [userPrivacySettings.userId], references: [users.id] }),
}));

export const userDiscoverPreferencesRelations = relations(userDiscoverPreferences, ({ one }) => ({
  user: one(users, { fields: [userDiscoverPreferences.userId], references: [users.id] }),
}));
