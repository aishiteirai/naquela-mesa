import { sql } from "drizzle-orm";
import { check, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { user } from "../auth/schema";
import { stores } from "../stores/schema";
import { FULFILLMENTS, ORDER_CHANNELS, ORDER_STATUSES, PAYMENT_METHODS, type OrderAddress } from "./types";

/** Último número de pedido emitido por loja (incremento atômico via upsert). */
export const orderCounters = pgTable("order_counters", {
  storeId: uuid("store_id")
    .primaryKey()
    .references(() => stores.id, { onDelete: "cascade" }),
  lastNumber: integer("last_number").notNull().default(0),
});

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    number: integer("number").notNull(),
    publicToken: text("public_token").notNull().unique(),
    idempotencyKey: uuid("idempotency_key").notNull(),
    channel: text("channel", { enum: ORDER_CHANNELS }).notNull(),
    status: text("status", { enum: ORDER_STATUSES }).notNull().default("received"),
    fulfillment: text("fulfillment", { enum: FULFILLMENTS }).notNull(),
    customerName: text("customer_name").notNull(),
    customerPhone: text("customer_phone").notNull(),
    address: jsonb("address").$type<OrderAddress>(),
    tableLabel: text("table_label"),
    paymentMethod: text("payment_method", { enum: PAYMENT_METHODS }).notNull(),
    changeForCents: integer("change_for_cents"),
    notes: text("notes"),
    cancelReason: text("cancel_reason"),
    subtotalCents: integer("subtotal_cents").notNull(),
    deliveryFeeCents: integer("delivery_fee_cents").notNull(),
    discountCents: integer("discount_cents").notNull().default(0),
    totalCents: integer("total_cents").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("orders_store_created_at_idx").on(t.storeId, t.createdAt),
    index("orders_store_updated_at_idx").on(t.storeId, t.updatedAt),
    index("orders_store_status_idx").on(t.storeId, t.status),
    uniqueIndex("orders_store_number_idx").on(t.storeId, t.number),
    uniqueIndex("orders_store_idempotency_idx").on(t.storeId, t.idempotencyKey),
    check(
      "orders_amounts_check",
      sql`${t.subtotalCents} >= 0 and ${t.deliveryFeeCents} >= 0 and ${t.discountCents} >= 0 and ${t.totalCents} >= 0`,
    ),
  ],
);

export const orderItems = pgTable(
  "order_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    productName: text("product_name").notNull(),
    sizeName: text("size_name"),
    flavors: jsonb("flavors").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    quantity: integer("quantity").notNull(),
    unitPriceCents: integer("unit_price_cents").notNull(),
    totalCents: integer("total_cents").notNull(),
    notes: text("notes"),
    position: integer("position").notNull().default(0),
  },
  (t) => [
    index("order_items_order_id_idx").on(t.orderId),
    check("order_items_quantity_check", sql`${t.quantity} between 1 and 50`),
    check("order_items_amounts_check", sql`${t.unitPriceCents} >= 0 and ${t.totalCents} >= 0`),
  ],
);

export const orderItemOptions = pgTable(
  "order_item_options",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderItemId: uuid("order_item_id")
      .notNull()
      .references(() => orderItems.id, { onDelete: "cascade" }),
    groupName: text("group_name").notNull(),
    optionName: text("option_name").notNull(),
    priceCents: integer("price_cents").notNull(),
  },
  (t) => [
    index("order_item_options_item_id_idx").on(t.orderItemId),
    check("order_item_options_price_check", sql`${t.priceCents} >= 0`),
  ],
);

export const orderStatusEvents = pgTable(
  "order_status_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    status: text("status", { enum: ORDER_STATUSES }).notNull(),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
    byUserId: text("by_user_id").references(() => user.id, { onDelete: "set null" }),
  },
  (t) => [index("order_status_events_order_id_idx").on(t.orderId)],
);
