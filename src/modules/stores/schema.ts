import { sql } from "drizzle-orm";
import { check, doublePrecision, index, integer, jsonb, pgTable, smallint, text, time, timestamp, uuid } from "drizzle-orm/pg-core";
import type { StoreFeatures, StorePaymentMethods, StoreRules, StoreTheme } from "./settings";

export const stores = pgTable("stores", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  whatsappPhone: text("whatsapp_phone").notNull(),
  address: text("address"),
  lat: doublePrecision("lat"),
  lng: doublePrecision("lng"),
  logoUrl: text("logo_url"),
  bannerUrl: text("banner_url"),
  timezone: text("timezone").notNull().default("America/Sao_Paulo"),
  orderSeq: integer("order_seq").notNull().default(0),
  theme: jsonb("theme").$type<StoreTheme>().notNull(),
  features: jsonb("features").$type<StoreFeatures>().notNull(),
  rules: jsonb("rules").$type<StoreRules>().notNull(),
  paymentMethods: jsonb("payment_methods").$type<StorePaymentMethods>().notNull(),
  manualStatus: text("manual_status", { enum: ["auto", "force_open", "force_closed"] }).notNull().default("auto"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const storeHours = pgTable(
  "store_hours",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    weekday: smallint("weekday").notNull(),
    opensAt: time("opens_at").notNull(),
    closesAt: time("closes_at").notNull(),
  },
  (t) => [
    index("store_hours_store_id_idx").on(t.storeId),
    check("store_hours_weekday_check", sql`${t.weekday} between 0 and 6`),
  ],
);
