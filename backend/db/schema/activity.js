import {
  pgTable, uuid, varchar, timestamp, index, pgEnum,
} from 'drizzle-orm/pg-core'
import { users } from './users.js'

export const activityEventEnum = pgEnum('activity_event_type', [
  'app_open', 'swipe_start', 'session_end',
])

export const activityEvents = pgTable('activity_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  event: activityEventEnum('event').notNull(),
  platform: varchar('platform', { length: 20 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  userIdx: index('activity_events_user_idx').on(t.userId),
  eventIdx: index('activity_events_event_idx').on(t.event),
  createdIdx: index('activity_events_created_idx').on(t.createdAt),
  userEventDayIdx: index('activity_events_user_event_day_idx').on(t.userId, t.event, t.createdAt),
}))
