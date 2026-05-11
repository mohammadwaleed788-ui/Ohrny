import {
  pgTable, uuid, varchar, text, boolean, timestamp, index,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { users } from './users.js'

export const userDevices = pgTable('user_devices', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),

  // Client-generated stable identifier for a physical device/app install
  deviceId: varchar('device_id', { length: 255 }).notNull().unique(),
  deviceName: varchar('device_model', { length: 255 }),
  devicePlatform: varchar('device_platform', { length: 20 }),
  timezone: varchar('timezone', { length: 50 }).notNull().default('UTC'),

  fcmToken: text('fcm_token'),
  pushNotificationEnabled: boolean('push_notification_enabled').notNull().default(true),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  userIdx: index('user_devices_user_idx').on(t.userId),
  platformIdx: index('user_devices_platform_idx').on(t.devicePlatform),
}))

export const userDevicesRelations = relations(userDevices, ({ one }) => ({
  user: one(users, {
    fields: [userDevices.userId],
    references: [users.id],
  }),
}))
