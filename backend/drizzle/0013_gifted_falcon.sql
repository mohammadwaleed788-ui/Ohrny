CREATE TABLE "profile_views" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"viewer_id" uuid NOT NULL,
	"viewed_id" uuid NOT NULL,
	"seen_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_viewed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_privacy_settings" ALTER COLUMN "anonymous_handle" SET DEFAULT false;--> statement-breakpoint
UPDATE "user_privacy_settings" SET "anonymous_handle" = false;--> statement-breakpoint
ALTER TABLE "profile_views" ADD CONSTRAINT "profile_views_viewer_id_users_id_fk" FOREIGN KEY ("viewer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_views" ADD CONSTRAINT "profile_views_viewed_id_users_id_fk" FOREIGN KEY ("viewed_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "profile_views_pair_uniq" ON "profile_views" USING btree ("viewer_id","viewed_id");--> statement-breakpoint
CREATE INDEX "profile_views_viewed_idx" ON "profile_views" USING btree ("viewed_id");--> statement-breakpoint
CREATE INDEX "profile_views_viewer_idx" ON "profile_views" USING btree ("viewer_id");