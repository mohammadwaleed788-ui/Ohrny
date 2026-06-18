import {
  pgTable, uuid, varchar, text, timestamp, index, smallint, boolean,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './users.js';
import { adminUsers } from './admin.js';

export const supportTickets = pgTable('support_tickets', {
  id:                uuid('id').primaryKey().defaultRandom(),
  ticketNo:          varchar('ticket_no', { length: 24 }).notNull(),
  requesterUserId:   uuid('requester_user_id').references(() => users.id, { onDelete: 'set null' }),
  createdByAdminId:  uuid('created_by_admin_id').references(() => adminUsers.id, { onDelete: 'set null' }),
  subject:           varchar('subject', { length: 180 }).notNull(),
  description:       text('description'),
  category:          varchar('category', { length: 32 }).notNull().default('general'),
  severity:          varchar('severity', { length: 16 }).notNull().default('low'),
  status:            varchar('status', { length: 16 }).notNull().default('open'),
  source:            varchar('source', { length: 16 }).notNull().default('user'),
  assigneeAdminId:   uuid('assignee_admin_id').references(() => adminUsers.id, { onDelete: 'set null' }),
  firstRespondedAt:  timestamp('first_responded_at', { withTimezone: true }),
  lastMessageAt:     timestamp('last_message_at', { withTimezone: true }).notNull().defaultNow(),
  closedAt:          timestamp('closed_at', { withTimezone: true }),
  csatScore:         smallint('csat_score'),
  createdAt:         timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:         timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  ticketNoIdx: index('support_tickets_ticket_no_idx').on(t.ticketNo),
  requesterIdx: index('support_tickets_requester_idx').on(t.requesterUserId),
  statusIdx: index('support_tickets_status_idx').on(t.status),
  severityIdx: index('support_tickets_severity_idx').on(t.severity),
  assigneeIdx: index('support_tickets_assignee_idx').on(t.assigneeAdminId),
  createdIdx: index('support_tickets_created_idx').on(t.createdAt),
}));

export const supportTicketMessages = pgTable('support_ticket_messages', {
  id:             uuid('id').primaryKey().defaultRandom(),
  ticketId:       uuid('ticket_id').notNull().references(() => supportTickets.id, { onDelete: 'cascade' }),
  authorUserId:   uuid('author_user_id').references(() => users.id, { onDelete: 'set null' }),
  authorAdminId:  uuid('author_admin_id').references(() => adminUsers.id, { onDelete: 'set null' }),
  kind:           varchar('kind', { length: 24 }).notNull().default('reply'),
  body:           text('body').notNull(),
  isInternal:     boolean('is_internal').notNull().default(false),
  createdAt:      timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  ticketIdx: index('support_ticket_messages_ticket_idx').on(t.ticketId),
  createdIdx: index('support_ticket_messages_created_idx').on(t.createdAt),
}));

export const supportTicketsRelations = relations(supportTickets, ({ one, many }) => ({
  requester: one(users, { fields: [supportTickets.requesterUserId], references: [users.id] }),
  creatorAdmin: one(adminUsers, { fields: [supportTickets.createdByAdminId], references: [adminUsers.id], relationName: 'createdSupportTickets' }),
  assignee: one(adminUsers, { fields: [supportTickets.assigneeAdminId], references: [adminUsers.id], relationName: 'assignedSupportTickets' }),
  messages: many(supportTicketMessages),
}));

export const supportTicketMessagesRelations = relations(supportTicketMessages, ({ one }) => ({
  ticket: one(supportTickets, { fields: [supportTicketMessages.ticketId], references: [supportTickets.id] }),
  authorUser: one(users, { fields: [supportTicketMessages.authorUserId], references: [users.id] }),
  authorAdmin: one(adminUsers, { fields: [supportTicketMessages.authorAdminId], references: [adminUsers.id] }),
}));
