import { sql } from "drizzle-orm";
import { boolean, check, index, integer, pgTable, primaryKey, smallint, text, uuid } from "drizzle-orm/pg-core";
import { stores } from "../stores/schema";

const storeId = () =>
  uuid("store_id")
    .notNull()
    .references(() => stores.id, { onDelete: "cascade" });

export const categories = pgTable(
  "categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: storeId(),
    name: text("name").notNull(),
    position: integer("position").notNull().default(0),
    active: boolean("active").notNull().default(true),
  },
  (t) => [index("categories_store_id_idx").on(t.storeId)],
);

export const categorySizes = pgTable(
  "category_sizes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: storeId(),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    maxFlavors: smallint("max_flavors").notNull().default(1),
    position: integer("position").notNull().default(0),
  },
  (t) => [
    index("category_sizes_store_id_idx").on(t.storeId),
    index("category_sizes_category_id_idx").on(t.categoryId),
    check("category_sizes_max_flavors_check", sql`${t.maxFlavors} between 1 and 2`),
  ],
);

export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: storeId(),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    imageUrl: text("image_url"),
    priceCents: integer("price_cents"),
    allowsHalf: boolean("allows_half").notNull().default(false),
    active: boolean("active").notNull().default(true),
    available: boolean("available").notNull().default(true),
    position: integer("position").notNull().default(0),
  },
  (t) => [
    index("products_store_id_idx").on(t.storeId),
    index("products_category_id_idx").on(t.categoryId),
    check("products_price_cents_check", sql`${t.priceCents} is null or ${t.priceCents} >= 0`),
  ],
);

export const productSizePrices = pgTable(
  "product_size_prices",
  {
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    categorySizeId: uuid("category_size_id")
      .notNull()
      .references(() => categorySizes.id, { onDelete: "cascade" }),
    priceCents: integer("price_cents").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.productId, t.categorySizeId] }),
    check("product_size_prices_price_cents_check", sql`${t.priceCents} >= 0`),
  ],
);

export const optionGroups = pgTable(
  "option_groups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: storeId(),
    name: text("name").notNull(),
    minSelect: smallint("min_select").notNull().default(0),
    maxSelect: smallint("max_select").notNull().default(1),
    position: integer("position").notNull().default(0),
  },
  (t) => [
    index("option_groups_store_id_idx").on(t.storeId),
    check("option_groups_select_check", sql`${t.minSelect} >= 0 and ${t.maxSelect} >= 1 and ${t.maxSelect} >= ${t.minSelect}`),
  ],
);

export const options = pgTable(
  "options",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: storeId(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => optionGroups.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    priceCents: integer("price_cents").notNull().default(0),
    available: boolean("available").notNull().default(true),
    position: integer("position").notNull().default(0),
  },
  (t) => [
    index("options_store_id_idx").on(t.storeId),
    index("options_group_id_idx").on(t.groupId),
    check("options_price_cents_check", sql`${t.priceCents} >= 0`),
  ],
);

export const productOptionGroups = pgTable(
  "product_option_groups",
  {
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    groupId: uuid("group_id")
      .notNull()
      .references(() => optionGroups.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.productId, t.groupId] })],
);
