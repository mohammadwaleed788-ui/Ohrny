ALTER TABLE "support_tickets" ADD COLUMN IF NOT EXISTS "last_user_read_at" timestamp with time zone;
