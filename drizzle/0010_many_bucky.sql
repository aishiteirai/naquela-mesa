DROP INDEX "store_members_user_id_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "store_members_user_id_unique" ON "store_members" USING btree ("user_id");