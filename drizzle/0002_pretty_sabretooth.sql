CREATE TABLE "store_hours" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"weekday" smallint NOT NULL,
	"opens_at" time NOT NULL,
	"closes_at" time NOT NULL,
	CONSTRAINT "store_hours_weekday_check" CHECK ("store_hours"."weekday" between 0 and 6)
);
--> statement-breakpoint
CREATE TABLE "stores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"whatsapp_phone" text NOT NULL,
	"address" text,
	"lat" double precision,
	"lng" double precision,
	"logo_url" text,
	"banner_url" text,
	"timezone" text DEFAULT 'America/Sao_Paulo' NOT NULL,
	"order_seq" integer DEFAULT 0 NOT NULL,
	"theme" jsonb NOT NULL,
	"features" jsonb NOT NULL,
	"rules" jsonb NOT NULL,
	"payment_methods" jsonb NOT NULL,
	"manual_status" text DEFAULT 'auto' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stores_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "store_hours" ADD CONSTRAINT "store_hours_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "store_hours_store_id_idx" ON "store_hours" USING btree ("store_id");