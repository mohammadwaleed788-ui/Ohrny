CREATE TYPE "public"."subscription_duration" AS ENUM('1w', '1m', '3m', '6m');--> statement-breakpoint
CREATE TABLE "subscription_plan_products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" varchar(20) NOT NULL,
	"platform" "platform_type" NOT NULL,
	"duration" "subscription_duration" NOT NULL,
	"revenue_cat_product_id" varchar(120) NOT NULL,
	"currency" varchar(4) DEFAULT 'EUR' NOT NULL,
	"total_price" numeric(8, 2) NOT NULL,
	"weekly_price" numeric(8, 2) NOT NULL,
	"compare_at_weekly_price" numeric(8, 2),
	"discount_percent" smallint,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"sort_order" smallint DEFAULT 0 NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscription_plan_products_revenue_cat_product_id_unique" UNIQUE("revenue_cat_product_id")
);
--> statement-breakpoint
ALTER TABLE "user_subscriptions" ADD COLUMN "product_id" uuid;--> statement-breakpoint
ALTER TABLE "user_subscriptions" ADD COLUMN "revenue_cat_product_id" varchar(120);--> statement-breakpoint
ALTER TABLE "user_subscriptions" ADD COLUMN "duration" "subscription_duration";--> statement-breakpoint
ALTER TABLE "subscription_plan_products" ADD CONSTRAINT "subscription_plan_products_plan_id_subscription_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."subscription_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "subscription_plan_products_ppd_idx" ON "subscription_plan_products" USING btree ("plan_id","platform","duration");--> statement-breakpoint
CREATE INDEX "subscription_plan_products_active_idx" ON "subscription_plan_products" USING btree ("is_active","sort_order");--> statement-breakpoint
ALTER TABLE "user_subscriptions" ADD CONSTRAINT "user_subscriptions_product_id_subscription_plan_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."subscription_plan_products"("id") ON DELETE set null ON UPDATE no action;