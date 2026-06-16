CREATE TABLE "user_travel_locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"lat" varchar(32) NOT NULL,
	"lng" varchar(32) NOT NULL,
	"city" varchar(120) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_discover_preferences" ADD COLUMN "travel_lat" varchar(32);--> statement-breakpoint
ALTER TABLE "user_discover_preferences" ADD COLUMN "travel_lng" varchar(32);--> statement-breakpoint
ALTER TABLE "user_discover_preferences" ADD COLUMN "travel_city" varchar(120);--> statement-breakpoint
ALTER TABLE "user_travel_locations" ADD CONSTRAINT "user_travel_locations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "travel_loc_user_idx" ON "user_travel_locations" USING btree ("user_id");