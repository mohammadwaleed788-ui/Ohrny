CREATE TABLE "support_tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_no" varchar(24) NOT NULL,
	"requester_user_id" uuid,
	"created_by_admin_id" uuid,
	"subject" varchar(180) NOT NULL,
	"description" text,
	"category" varchar(32) DEFAULT 'general' NOT NULL,
	"severity" varchar(16) DEFAULT 'low' NOT NULL,
	"status" varchar(16) DEFAULT 'open' NOT NULL,
	"source" varchar(16) DEFAULT 'user' NOT NULL,
	"assignee_admin_id" uuid,
	"first_responded_at" timestamp with time zone,
	"last_message_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone,
	"csat_score" smallint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "support_ticket_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" uuid NOT NULL,
	"author_user_id" uuid,
	"author_admin_id" uuid,
	"kind" varchar(24) DEFAULT 'reply' NOT NULL,
	"body" text NOT NULL,
	"is_internal" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_requester_user_id_users_id_fk" FOREIGN KEY ("requester_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_created_by_admin_id_admin_users_id_fk" FOREIGN KEY ("created_by_admin_id") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_assignee_admin_id_admin_users_id_fk" FOREIGN KEY ("assignee_admin_id") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_ticket_messages" ADD CONSTRAINT "support_ticket_messages_ticket_id_support_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."support_tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_ticket_messages" ADD CONSTRAINT "support_ticket_messages_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_ticket_messages" ADD CONSTRAINT "support_ticket_messages_author_admin_id_admin_users_id_fk" FOREIGN KEY ("author_admin_id") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "support_tickets_ticket_no_idx" ON "support_tickets" USING btree ("ticket_no");--> statement-breakpoint
CREATE INDEX "support_tickets_requester_idx" ON "support_tickets" USING btree ("requester_user_id");--> statement-breakpoint
CREATE INDEX "support_tickets_status_idx" ON "support_tickets" USING btree ("status");--> statement-breakpoint
CREATE INDEX "support_tickets_severity_idx" ON "support_tickets" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "support_tickets_assignee_idx" ON "support_tickets" USING btree ("assignee_admin_id");--> statement-breakpoint
CREATE INDEX "support_tickets_created_idx" ON "support_tickets" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "support_ticket_messages_ticket_idx" ON "support_ticket_messages" USING btree ("ticket_id");--> statement-breakpoint
CREATE INDEX "support_ticket_messages_created_idx" ON "support_ticket_messages" USING btree ("created_at");
