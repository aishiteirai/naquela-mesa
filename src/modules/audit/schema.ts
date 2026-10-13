import { sql } from "drizzle-orm";
import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { user } from "../auth/schema";
import { stores } from "../stores/schema";
import { AUDIT_ACTIONS } from "./types";

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorUserId: text("actor_user_id").references(() => user.id, { onDelete: "set null" }),
    action: text("action", { enum: AUDIT_ACTIONS }).notNull(),
    storeId: uuid("store_id").references(() => stores.id, { onDelete: "set null" }),
    details: jsonb("details").$type<Record<string, string>>().notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("audit_logs_created_at_idx").on(t.createdAt)],
);
