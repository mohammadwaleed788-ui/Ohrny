ALTER TABLE "user_discover_preferences" ADD COLUMN "height_min" smallint DEFAULT 140 NOT NULL;--> statement-breakpoint
ALTER TABLE "user_discover_preferences" ADD COLUMN "height_max" smallint DEFAULT 220 NOT NULL;--> statement-breakpoint
ALTER TABLE "user_discover_preferences" ADD COLUMN "height_unit" varchar(4) DEFAULT 'cm' NOT NULL;--> statement-breakpoint
ALTER TABLE "user_discover_preferences" ADD COLUMN "diet" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "user_discover_preferences" ADD COLUMN "drinks" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "user_discover_preferences" ADD COLUMN "smokes" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "user_discover_preferences" ADD COLUMN "exercise" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "user_discover_preferences" ADD COLUMN "kids" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "user_discover_preferences" ADD COLUMN "pets" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "user_discover_preferences" ADD COLUMN "education" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "user_discover_preferences" ADD COLUMN "religion" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "user_discover_preferences" ADD COLUMN "zodiac" text[] DEFAULT '{}'::text[] NOT NULL;