ALTER TABLE "matches" ADD COLUMN "user_a_seen_match" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "user_b_seen_match" boolean DEFAULT false NOT NULL;