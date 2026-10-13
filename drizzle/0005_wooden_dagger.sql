CREATE TABLE "delivery_zones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"neighborhood" text NOT NULL,
	"fee_cents" integer NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "delivery_zones_fee_cents_check" CHECK ("delivery_zones"."fee_cents" >= 0)
);
--> statement-breakpoint
ALTER TABLE "delivery_zones" ADD CONSTRAINT "delivery_zones_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "delivery_zones_store_id_idx" ON "delivery_zones" USING btree ("store_id");--> statement-breakpoint
CREATE UNIQUE INDEX "delivery_zones_store_neighborhood_idx" ON "delivery_zones" USING btree ("store_id",lower("neighborhood"));