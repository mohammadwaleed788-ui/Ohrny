CREATE TABLE "notification_reengagement_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(120) NOT NULL,
	"title" varchar(160) NOT NULL,
	"body" text NOT NULL,
	"deeplink" varchar(512),
	"inactive_days" integer DEFAULT 7 NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"updated_by_admin_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_reengagement_sends" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rule_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"device_id" varchar(255) NOT NULL,
	"fcm_token" text,
	"status" varchar(24) NOT NULL,
	"error_message" text,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notification_reengagement_rules" ADD CONSTRAINT "notification_reengagement_rules_updated_by_admin_id_admin_users_id_fk" FOREIGN KEY ("updated_by_admin_id") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_reengagement_sends" ADD CONSTRAINT "notification_reengagement_sends_rule_id_notification_reengagement_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."notification_reengagement_rules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_reengagement_sends" ADD CONSTRAINT "notification_reengagement_sends_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notif_reengage_enabled_idx" ON "notification_reengagement_rules" USING btree ("is_enabled","inactive_days");--> statement-breakpoint
CREATE INDEX "notif_reengage_sends_rule_idx" ON "notification_reengagement_sends" USING btree ("rule_id","created_at");--> statement-breakpoint
CREATE INDEX "notif_reengage_sends_rule_user_idx" ON "notification_reengagement_sends" USING btree ("rule_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "notif_reengage_sends_rule_device_uniq" ON "notification_reengagement_sends" USING btree ("rule_id","device_id");