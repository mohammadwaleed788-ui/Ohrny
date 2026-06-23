ALTER TABLE "admin_users" ADD COLUMN "team_role_preset" varchar(32);--> statement-breakpoint
ALTER TABLE "admin_users" ADD COLUMN "tab_permissions" jsonb DEFAULT '[]'::jsonb NOT NULL;
