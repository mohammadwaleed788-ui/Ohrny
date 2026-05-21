CREATE TYPE "public"."activity_event_type" AS ENUM('app_open', 'swipe_start', 'session_end');--> statement-breakpoint
ALTER TYPE "public"."discover_rel_type" ADD VALUE 'friends' BEFORE 'open';--> statement-breakpoint
ALTER TYPE "public"."discover_rel_type" ADD VALUE 'figuring_out' BEFORE 'open';--> statement-breakpoint
CREATE TABLE "activity_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"event" "activity_event_type" NOT NULL,
	"platform" varchar(20),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "likes" ADD COLUMN "seen_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activity_events_user_idx" ON "activity_events" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "activity_events_event_idx" ON "activity_events" USING btree ("event");--> statement-breakpoint
CREATE INDEX "activity_events_created_idx" ON "activity_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "activity_events_user_event_day_idx" ON "activity_events" USING btree ("user_id","event","created_at");