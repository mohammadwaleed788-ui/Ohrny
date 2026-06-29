CREATE TYPE "public"."billing_event_type" AS ENUM('subscription_started', 'subscription_renewed', 'subscription_cancelled', 'subscription_expired', 'trial_started', 'trial_converted', 'consumable_purchase', 'refund');--> statement-breakpoint
ALTER TYPE "public"."purchase_type" ADD VALUE 'read_receipts';--> statement-breakpoint
ALTER TYPE "public"."purchase_type" ADD VALUE 'rewind';--> statement-breakpoint
ALTER TYPE "public"."purchase_type" ADD VALUE 'incognito';--> statement-breakpoint
CREATE TABLE "billing_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"event_type" "billing_event_type" NOT NULL,
	"metric_kind" varchar(24) NOT NULL,
	"consumable_type" "purchase_type",
	"plan_id" varchar(20),
	"amount" numeric(10, 2) DEFAULT '0' NOT NULL,
	"currency" varchar(4) DEFAULT 'EUR' NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source" varchar(30) DEFAULT 'revenuecat' NOT NULL,
	"revenue_cat_event_type" varchar(50),
	"revenue_cat_product_id" varchar(120),
	"revenue_cat_transaction_id" varchar(120),
	"payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "billing_events" ADD CONSTRAINT "billing_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_events" ADD CONSTRAINT "billing_events_plan_id_subscription_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."subscription_plans"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "billing_events_occurred_idx" ON "billing_events" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "billing_events_type_idx" ON "billing_events" USING btree ("event_type","metric_kind");--> statement-breakpoint
CREATE INDEX "billing_events_user_idx" ON "billing_events" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "billing_events_rc_tx_idx" ON "billing_events" USING btree ("revenue_cat_transaction_id");