CREATE TABLE "admin_audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admin_id" uuid,
	"action" varchar(80) NOT NULL,
	"target_type" varchar(40) NOT NULL,
	"target_id" varchar(128),
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "appeals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"enforcement_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"statement" text NOT NULL,
	"status" varchar(24) DEFAULT 'open' NOT NULL,
	"decision" varchar(24),
	"decision_note" text,
	"decided_by_admin_id" uuid,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_enforcements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"report_id" uuid,
	"action" varchar(32) NOT NULL,
	"reason" text,
	"note" text,
	"active" boolean DEFAULT true NOT NULL,
	"starts_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ends_at" timestamp with time zone,
	"created_by_admin_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "banned_by_admin_id" uuid;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "ban_reason" text;--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "assigned_to_admin_id" uuid;--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "assigned_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "enforcement_id" uuid;--> statement-breakpoint
ALTER TABLE "admin_audit_logs" ADD CONSTRAINT "admin_audit_logs_admin_id_admin_users_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appeals" ADD CONSTRAINT "appeals_enforcement_id_user_enforcements_id_fk" FOREIGN KEY ("enforcement_id") REFERENCES "public"."user_enforcements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appeals" ADD CONSTRAINT "appeals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appeals" ADD CONSTRAINT "appeals_decided_by_admin_id_admin_users_id_fk" FOREIGN KEY ("decided_by_admin_id") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_enforcements" ADD CONSTRAINT "user_enforcements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_enforcements" ADD CONSTRAINT "user_enforcements_report_id_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_enforcements" ADD CONSTRAINT "user_enforcements_created_by_admin_id_admin_users_id_fk" FOREIGN KEY ("created_by_admin_id") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "admin_audit_logs_admin_idx" ON "admin_audit_logs" USING btree ("admin_id");--> statement-breakpoint
CREATE INDEX "admin_audit_logs_action_idx" ON "admin_audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "admin_audit_logs_target_idx" ON "admin_audit_logs" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "admin_audit_logs_created_idx" ON "admin_audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "appeals_enforcement_idx" ON "appeals" USING btree ("enforcement_id");--> statement-breakpoint
CREATE INDEX "appeals_user_idx" ON "appeals" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "appeals_status_idx" ON "appeals" USING btree ("status");--> statement-breakpoint
CREATE INDEX "appeals_created_idx" ON "appeals" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "user_enforcements_user_idx" ON "user_enforcements" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_enforcements_report_idx" ON "user_enforcements" USING btree ("report_id");--> statement-breakpoint
CREATE INDEX "user_enforcements_active_idx" ON "user_enforcements" USING btree ("active");--> statement-breakpoint
CREATE INDEX "user_enforcements_created_idx" ON "user_enforcements" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "user_enforcements_created_by_idx" ON "user_enforcements" USING btree ("created_by_admin_id");--> statement-breakpoint
CREATE INDEX "reports_assigned_admin_idx" ON "reports" USING btree ("assigned_to_admin_id");--> statement-breakpoint
CREATE INDEX "reports_reviewed_admin_idx" ON "reports" USING btree ("reviewed_by_admin_id");