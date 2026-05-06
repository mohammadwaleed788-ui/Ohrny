CREATE TYPE "public"."admin_role" AS ENUM('super_admin', 'moderator', 'support');--> statement-breakpoint
CREATE TYPE "public"."call_status" AS ENUM('initiated', 'answered', 'declined', 'ended', 'missed');--> statement-breakpoint
CREATE TYPE "public"."call_type" AS ENUM('voice', 'video');--> statement-breakpoint
CREATE TYPE "public"."discover_rel_type" AS ENUM('serious', 'dating', 'casual', 'non_monogamy', 'open');--> statement-breakpoint
CREATE TYPE "public"."disguise_type" AS ENUM('ohrny', 'calc', 'files', 'voice', 'compass', 'weather');--> statement-breakpoint
CREATE TYPE "public"."iam_type" AS ENUM('woman', 'man', 'nonbinary', 'other');--> statement-breakpoint
CREATE TYPE "public"."like_type" AS ENUM('like', 'super_like', 'pass');--> statement-breakpoint
CREATE TYPE "public"."plan_type" AS ENUM('free', 'plus', 'platin', 'private');--> statement-breakpoint
CREATE TYPE "public"."platform_type" AS ENUM('ios', 'android', 'web');--> statement-breakpoint
CREATE TYPE "public"."purchase_type" AS ENUM('super_likes', 'boosts');--> statement-breakpoint
CREATE TYPE "public"."rel_status" AS ENUM('single', 'in_relationship', 'married', 'non_monogamous', 'complicated', 'prefer_not_say');--> statement-breakpoint
CREATE TYPE "public"."relationship_goal" AS ENUM('casual', 'dating', 'serious', 'non_monogamy', 'friends', 'figuring_out');--> statement-breakpoint
CREATE TYPE "public"."report_reason" AS ENUM('fake', 'inappropriate', 'harassment', 'minor', 'spam', 'safety', 'other');--> statement-breakpoint
CREATE TYPE "public"."report_status" AS ENUM('pending', 'reviewed', 'actioned', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('active', 'expired', 'cancelled', 'pending', 'grace_period');--> statement-breakpoint
CREATE TYPE "public"."two_fa_method" AS ENUM('sms', 'skipped');--> statement-breakpoint
CREATE TABLE "user_interests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"interest" varchar(60) NOT NULL,
	"position" smallint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_lifestyle" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"height" varchar(20),
	"drinks" varchar(40),
	"smokes" varchar(40),
	"kids" varchar(60),
	"pets" varchar(60),
	"diet" varchar(60),
	"exercise" varchar(60),
	"religion" varchar(60),
	"education" varchar(60),
	"zodiac" varchar(20),
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_lifestyle_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "user_photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"position" smallint NOT NULL,
	"storage_key" varchar(512) NOT NULL,
	"blur_amount" smallint DEFAULT 70 NOT NULL,
	"is_blurred" boolean DEFAULT true NOT NULL,
	"is_main" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "user_prompts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"position" smallint NOT NULL,
	"title" varchar(80) NOT NULL,
	"answer" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"handle" varchar(24) NOT NULL,
	"phone" varchar(20) NOT NULL,
	"phone_country" varchar(6) DEFAULT '+1' NOT NULL,
	"phone_verified" boolean DEFAULT false NOT NULL,
	"two_fa_method" "two_fa_method",
	"age" smallint NOT NULL,
	"iam" "iam_type" NOT NULL,
	"iam_other" varchar(60),
	"pronouns" varchar(40),
	"bio" text,
	"about_me" text,
	"looking" varchar(120),
	"relationship_goal" "relationship_goal",
	"rel_status" "rel_status",
	"work" varchar(120),
	"orientation" text[] DEFAULT '{}'::text[] NOT NULL,
	"city" varchar(100),
	"country_code" varchar(4),
	"lat_approx" varchar(12),
	"lng_approx" varchar(12),
	"location_granted" boolean DEFAULT false NOT NULL,
	"search_radius" smallint DEFAULT 25 NOT NULL,
	"min_radius" smallint DEFAULT 0 NOT NULL,
	"my_blur" smallint DEFAULT 70 NOT NULL,
	"id_verified" boolean DEFAULT false NOT NULL,
	"profile_complete_pct" smallint DEFAULT 0 NOT NULL,
	"plan" "plan_type" DEFAULT 'free' NOT NULL,
	"revenue_cat_user_id" varchar(120),
	"swipes_used_today" smallint DEFAULT 0 NOT NULL,
	"swipes_reset_at" timestamp with time zone,
	"matches_started" smallint DEFAULT 0 NOT NULL,
	"super_likes_left" smallint DEFAULT 0 NOT NULL,
	"boosts_left" smallint DEFAULT 0 NOT NULL,
	"disguise" "disguise_type" DEFAULT 'ohrny' NOT NULL,
	"panic_fab_enabled" boolean DEFAULT true NOT NULL,
	"is_banned" boolean DEFAULT false NOT NULL,
	"is_paused" boolean DEFAULT false NOT NULL,
	"paused_until" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_handle_unique" UNIQUE("handle")
);
--> statement-breakpoint
CREATE TABLE "user_discover_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"max_distance" smallint DEFAULT 25 NOT NULL,
	"min_distance" smallint DEFAULT 0 NOT NULL,
	"age_min" smallint DEFAULT 18 NOT NULL,
	"age_max" smallint DEFAULT 70 NOT NULL,
	"relationship_type" "discover_rel_type" DEFAULT 'dating' NOT NULL,
	"photo_blur_visibility" smallint DEFAULT 70 NOT NULL,
	"verified_only" boolean DEFAULT false NOT NULL,
	"advanced_compatibility" boolean DEFAULT false NOT NULL,
	"travel_mode" boolean DEFAULT false NOT NULL,
	"global_mode" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_discover_preferences_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "user_privacy_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"blur_photos" boolean DEFAULT true NOT NULL,
	"anonymous_handle" boolean DEFAULT true NOT NULL,
	"ephemeral_messages" boolean DEFAULT true NOT NULL,
	"screenshot_shield" boolean DEFAULT true NOT NULL,
	"incognito_mode" boolean DEFAULT false NOT NULL,
	"analytics_consent" boolean DEFAULT true NOT NULL,
	"personalization_consent" boolean DEFAULT true NOT NULL,
	"marketing_emails" boolean DEFAULT false NOT NULL,
	"third_party_measurement" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_privacy_settings_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "likes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"from_user_id" uuid NOT NULL,
	"to_user_id" uuid NOT NULL,
	"type" "like_type" NOT NULL,
	"match_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_a_id" uuid NOT NULL,
	"user_b_id" uuid NOT NULL,
	"matched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_a_unlock_requested" boolean DEFAULT false NOT NULL,
	"user_b_unlock_requested" boolean DEFAULT false NOT NULL,
	"photos_unlocked" boolean DEFAULT false NOT NULL,
	"photos_unlocked_at" timestamp with time zone,
	"message_count_user_a" smallint DEFAULT 0 NOT NULL,
	"message_count_user_b" smallint DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"unmatched_at" timestamp with time zone,
	"unmatched_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "calls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_id" uuid NOT NULL,
	"caller_id" uuid NOT NULL,
	"callee_id" uuid NOT NULL,
	"type" "call_type" NOT NULL,
	"status" "call_status" DEFAULT 'initiated' NOT NULL,
	"voice_masked" boolean DEFAULT true NOT NULL,
	"caller_selfie_blurred" boolean DEFAULT true NOT NULL,
	"started_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"duration_seconds" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_id" uuid NOT NULL,
	"sender_id" uuid NOT NULL,
	"content" text NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"read_at" timestamp with time zone,
	"is_ephemeral" boolean DEFAULT true NOT NULL,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "in_app_purchases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "purchase_type" NOT NULL,
	"quantity" smallint NOT NULL,
	"price_at_purchase" numeric(8, 2) NOT NULL,
	"currency" varchar(4) DEFAULT 'EUR' NOT NULL,
	"revenue_cat_product_id" varchar(120),
	"revenue_cat_transaction_id" varchar(120),
	"platform" "platform_type" NOT NULL,
	"purchased_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "in_app_purchases_revenue_cat_transaction_id_unique" UNIQUE("revenue_cat_transaction_id")
);
--> statement-breakpoint
CREATE TABLE "subscription_plans" (
	"id" varchar(20) PRIMARY KEY NOT NULL,
	"name" varchar(40) NOT NULL,
	"price_monthly" numeric(8, 2),
	"currency" varchar(4) DEFAULT 'EUR' NOT NULL,
	"revenue_cat_product_id_ios" varchar(120),
	"revenue_cat_product_id_android" varchar(120),
	"swipes_per_day" smallint,
	"max_chats" smallint,
	"max_messages_per_chat" smallint,
	"super_likes_per_week" smallint DEFAULT 0 NOT NULL,
	"can_see_likes" boolean DEFAULT false NOT NULL,
	"incognito_mode" boolean DEFAULT false NOT NULL,
	"priority_likes" boolean DEFAULT false NOT NULL,
	"read_receipts" boolean DEFAULT false NOT NULL,
	"weekly_boost" boolean DEFAULT false NOT NULL,
	"vault_feature" boolean DEFAULT false NOT NULL,
	"concierge" boolean DEFAULT false NOT NULL,
	"travel_mode" boolean DEFAULT false NOT NULL,
	"advanced_compatibility" boolean DEFAULT false NOT NULL,
	"global_mode" boolean DEFAULT false NOT NULL,
	"features_json" jsonb DEFAULT '[]' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_boosts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_free_weekly" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"plan_id" varchar(20) NOT NULL,
	"revenue_cat_purchase_token" varchar(512),
	"revenue_cat_entitlement_id" varchar(120),
	"revenue_cat_transaction_id" varchar(120),
	"status" "subscription_status" DEFAULT 'pending' NOT NULL,
	"platform" "platform_type" NOT NULL,
	"price_at_purchase" numeric(8, 2),
	"currency" varchar(4) DEFAULT 'EUR' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"grace_period_ends_at" timestamp with time zone,
	"raw_webhook_payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blocker_id" uuid NOT NULL,
	"blocked_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "phone_verifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone" varchar(20) NOT NULL,
	"phone_country" varchar(6) DEFAULT '+1' NOT NULL,
	"code_hash" varchar(128) NOT NULL,
	"attempts" smallint DEFAULT 0 NOT NULL,
	"verified" boolean DEFAULT false NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reporter_id" uuid NOT NULL,
	"reported_id" uuid NOT NULL,
	"reason" "report_reason" NOT NULL,
	"details" text,
	"status" "report_status" DEFAULT 'pending' NOT NULL,
	"reviewed_by_admin_id" uuid,
	"reviewed_at" timestamp with time zone,
	"resolution_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admin_id" uuid NOT NULL,
	"action" varchar(80) NOT NULL,
	"target_type" varchar(40),
	"target_id" uuid,
	"previous_state" jsonb,
	"new_state" jsonb,
	"ip_address" varchar(45),
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"name" varchar(80) NOT NULL,
	"role" "admin_role" DEFAULT 'support' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"totp_secret" varchar(64),
	"totp_enabled" boolean DEFAULT false NOT NULL,
	"last_login_at" timestamp with time zone,
	"last_login_ip" varchar(45),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admin_users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "user_interests" ADD CONSTRAINT "user_interests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_lifestyle" ADD CONSTRAINT "user_lifestyle_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_photos" ADD CONSTRAINT "user_photos_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_prompts" ADD CONSTRAINT "user_prompts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_discover_preferences" ADD CONSTRAINT "user_discover_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_privacy_settings" ADD CONSTRAINT "user_privacy_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "likes" ADD CONSTRAINT "likes_from_user_id_users_id_fk" FOREIGN KEY ("from_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "likes" ADD CONSTRAINT "likes_to_user_id_users_id_fk" FOREIGN KEY ("to_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_user_a_id_users_id_fk" FOREIGN KEY ("user_a_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_user_b_id_users_id_fk" FOREIGN KEY ("user_b_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_unmatched_by_user_id_users_id_fk" FOREIGN KEY ("unmatched_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calls" ADD CONSTRAINT "calls_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calls" ADD CONSTRAINT "calls_caller_id_users_id_fk" FOREIGN KEY ("caller_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calls" ADD CONSTRAINT "calls_callee_id_users_id_fk" FOREIGN KEY ("callee_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "in_app_purchases" ADD CONSTRAINT "in_app_purchases_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_boosts" ADD CONSTRAINT "user_boosts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_subscriptions" ADD CONSTRAINT "user_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_subscriptions" ADD CONSTRAINT "user_subscriptions_plan_id_subscription_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."subscription_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_blocker_id_users_id_fk" FOREIGN KEY ("blocker_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_blocked_id_users_id_fk" FOREIGN KEY ("blocked_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_id_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_reported_id_users_id_fk" FOREIGN KEY ("reported_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_audit_logs" ADD CONSTRAINT "admin_audit_logs_admin_id_admin_users_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_interests_user_idx" ON "user_interests" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_photos_user_pos_idx" ON "user_photos" USING btree ("user_id","position");--> statement-breakpoint
CREATE INDEX "user_photos_user_idx" ON "user_photos" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_prompts_user_pos_idx" ON "user_prompts" USING btree ("user_id","position");--> statement-breakpoint
CREATE INDEX "user_prompts_user_idx" ON "user_prompts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "users_handle_idx" ON "users" USING btree ("handle");--> statement-breakpoint
CREATE UNIQUE INDEX "users_phone_country_phone_uniq" ON "users" USING btree ("phone_country","phone");--> statement-breakpoint
CREATE INDEX "users_phone_idx" ON "users" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "users_plan_idx" ON "users" USING btree ("plan");--> statement-breakpoint
CREATE INDEX "users_city_idx" ON "users" USING btree ("city");--> statement-breakpoint
CREATE UNIQUE INDEX "likes_pair_uniq" ON "likes" USING btree ("from_user_id","to_user_id");--> statement-breakpoint
CREATE INDEX "likes_to_user_idx" ON "likes" USING btree ("to_user_id");--> statement-breakpoint
CREATE INDEX "likes_from_user_idx" ON "likes" USING btree ("from_user_id");--> statement-breakpoint
CREATE INDEX "likes_type_idx" ON "likes" USING btree ("type");--> statement-breakpoint
CREATE UNIQUE INDEX "matches_pair_uniq" ON "matches" USING btree ("user_a_id","user_b_id");--> statement-breakpoint
CREATE INDEX "matches_user_a_idx" ON "matches" USING btree ("user_a_id");--> statement-breakpoint
CREATE INDEX "matches_user_b_idx" ON "matches" USING btree ("user_b_id");--> statement-breakpoint
CREATE INDEX "matches_active_idx" ON "matches" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "calls_match_idx" ON "calls" USING btree ("match_id");--> statement-breakpoint
CREATE INDEX "calls_caller_idx" ON "calls" USING btree ("caller_id");--> statement-breakpoint
CREATE INDEX "calls_callee_idx" ON "calls" USING btree ("callee_id");--> statement-breakpoint
CREATE INDEX "messages_match_idx" ON "messages" USING btree ("match_id");--> statement-breakpoint
CREATE INDEX "messages_sender_idx" ON "messages" USING btree ("sender_id");--> statement-breakpoint
CREATE INDEX "messages_expires_idx" ON "messages" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "in_app_purchases_user_idx" ON "in_app_purchases" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "in_app_purchases_type_idx" ON "in_app_purchases" USING btree ("type");--> statement-breakpoint
CREATE INDEX "user_boosts_user_idx" ON "user_boosts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_boosts_active_idx" ON "user_boosts" USING btree ("is_active","expires_at");--> statement-breakpoint
CREATE INDEX "user_subscriptions_user_idx" ON "user_subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_subscriptions_status_idx" ON "user_subscriptions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "user_subscriptions_expires_idx" ON "user_subscriptions" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "blocks_pair_uniq" ON "blocks" USING btree ("blocker_id","blocked_id");--> statement-breakpoint
CREATE INDEX "blocks_blocker_idx" ON "blocks" USING btree ("blocker_id");--> statement-breakpoint
CREATE INDEX "blocks_blocked_idx" ON "blocks" USING btree ("blocked_id");--> statement-breakpoint
CREATE INDEX "phone_verifications_phone_idx" ON "phone_verifications" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "phone_verifications_expires_idx" ON "phone_verifications" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "reports_reporter_idx" ON "reports" USING btree ("reporter_id");--> statement-breakpoint
CREATE INDEX "reports_reported_idx" ON "reports" USING btree ("reported_id");--> statement-breakpoint
CREATE INDEX "reports_status_idx" ON "reports" USING btree ("status");--> statement-breakpoint
CREATE INDEX "reports_created_idx" ON "reports" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_admin_idx" ON "admin_audit_logs" USING btree ("admin_id");--> statement-breakpoint
CREATE INDEX "audit_logs_target_idx" ON "admin_audit_logs" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "audit_logs_created_idx" ON "admin_audit_logs" USING btree ("created_at");