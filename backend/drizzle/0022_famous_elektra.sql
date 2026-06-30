CREATE TABLE "notification_campaign_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
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
CREATE TABLE "notification_campaign_targets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(160) NOT NULL,
	"title" varchar(160) NOT NULL,
	"body" text NOT NULL,
	"deeplink" varchar(512),
	"channel" varchar(20) DEFAULT 'push' NOT NULL,
	"audience_type" varchar(40) DEFAULT 'all_users' NOT NULL,
	"status" varchar(24) DEFAULT 'draft' NOT NULL,
	"send_mode" varchar(20) DEFAULT 'draft' NOT NULL,
	"scheduled_at" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"total_targets" integer DEFAULT 0 NOT NULL,
	"total_sent" integer DEFAULT 0 NOT NULL,
	"total_failed" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"created_by_admin_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_privacy_settings" ADD COLUMN "campaign_notifications_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "notification_campaign_deliveries" ADD CONSTRAINT "notification_campaign_deliveries_campaign_id_notification_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."notification_campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_campaign_deliveries" ADD CONSTRAINT "notification_campaign_deliveries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_campaign_targets" ADD CONSTRAINT "notification_campaign_targets_campaign_id_notification_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."notification_campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_campaign_targets" ADD CONSTRAINT "notification_campaign_targets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_campaigns" ADD CONSTRAINT "notification_campaigns_created_by_admin_id_admin_users_id_fk" FOREIGN KEY ("created_by_admin_id") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notif_campaign_deliveries_campaign_idx" ON "notification_campaign_deliveries" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "notif_campaign_deliveries_status_idx" ON "notification_campaign_deliveries" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "notif_campaign_deliveries_campaign_device_uniq" ON "notification_campaign_deliveries" USING btree ("campaign_id","device_id");--> statement-breakpoint
CREATE INDEX "notif_campaign_targets_campaign_idx" ON "notification_campaign_targets" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "notif_campaign_targets_user_idx" ON "notification_campaign_targets" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "notif_campaign_targets_campaign_user_uniq" ON "notification_campaign_targets" USING btree ("campaign_id","user_id");--> statement-breakpoint
CREATE INDEX "notif_campaign_status_idx" ON "notification_campaigns" USING btree ("status","scheduled_at");--> statement-breakpoint
CREATE INDEX "notif_campaign_created_idx" ON "notification_campaigns" USING btree ("created_at");