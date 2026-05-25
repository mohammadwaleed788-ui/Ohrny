ALTER TABLE "messages" ADD COLUMN "deleted_for_user_id" uuid;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_deleted_for_user_id_users_id_fk" FOREIGN KEY ("deleted_for_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "messages_deleted_for_idx" ON "messages" USING btree ("deleted_for_user_id");