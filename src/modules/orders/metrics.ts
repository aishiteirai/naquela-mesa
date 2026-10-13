import { and, asc, count, desc, eq, gte, lt, ne, sql } from "drizzle-orm";
import { db } from "@/shared/db/client";
import { rankProducts, type RankedProduct } from "./ranking";
import { orderItems, orders } from "./schema";
import type { Fulfillment, OrderChannel } from "./types";

export type StoreMetrics = {
  revenueCents: number;
  orderCount: number;
  averageTicketCents: number;
  cancelledCount: number;
  topProducts: RankedProduct[];
  byHour: { hour: number; orders: number }[];
  byFulfillment: { fulfillment: Fulfillment; orders: number; revenueCents: number }[];
  byChannel: { channel: OrderChannel; orders: number; revenueCents: number }[];
};

const revenue = sql<number>`coalesce(sum(${orders.totalCents}), 0)`.mapWith(Number);

/** Indicadores do período (spec §7): tudo exceto cancelados; cancelados só no contador próprio. */
export async function getStoreMetrics(storeId: string, range: { start: Date; end: Date }, timeZone: string): Promise<StoreMetrics> {
  const inRange = and(eq(orders.storeId, storeId), gte(orders.createdAt, range.start), lt(orders.createdAt, range.end));
  const valid = and(inRange, ne(orders.status, "cancelled"));
  // GROUP BY 1: o fuso vira parâmetro, e repetir a expressão no GROUP BY criaria outro parâmetro ($n) que o Postgres recusa.
  const localHour = sql<number>`extract(hour from ${orders.createdAt} at time zone ${timeZone})::int`.mapWith(Number);

  const [summaryRows, byHour, byFulfillment, byChannel, lines] = await Promise.all([
    db
      .select({
        orderCount: sql<number>`count(*) filter (where ${orders.status} <> 'cancelled')`.mapWith(Number),
        cancelledCount: sql<number>`count(*) filter (where ${orders.status} = 'cancelled')`.mapWith(Number),
        revenueCents: sql<number>`coalesce(sum(${orders.totalCents}) filter (where ${orders.status} <> 'cancelled'), 0)`.mapWith(Number),
      })
      .from(orders)
      .where(inRange),
    db.select({ hour: localHour, orders: count() }).from(orders).where(valid).groupBy(sql`1`).orderBy(sql`1`),
    db
      .select({ fulfillment: orders.fulfillment, orders: count(), revenueCents: revenue })
      .from(orders)
      .where(valid)
      .groupBy(orders.fulfillment)
      .orderBy(desc(count()), asc(orders.fulfillment)),
    db
      .select({ channel: orders.channel, orders: count(), revenueCents: revenue })
      .from(orders)
      .where(valid)
      .groupBy(orders.channel)
      .orderBy(desc(count()), asc(orders.channel)),
    db
      .select({
        productName: orderItems.productName,
        sizeName: orderItems.sizeName,
        flavors: orderItems.flavors,
        quantity: orderItems.quantity,
        totalCents: orderItems.totalCents,
      })
      .from(orderItems)
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .where(valid),
  ]);

  const summary = summaryRows[0] ?? { orderCount: 0, cancelledCount: 0, revenueCents: 0 };
  return {
    revenueCents: summary.revenueCents,
    orderCount: summary.orderCount,
    averageTicketCents: summary.orderCount > 0 ? Math.round(summary.revenueCents / summary.orderCount) : 0,
    cancelledCount: summary.cancelledCount,
    topProducts: rankProducts(lines),
    byHour,
    byFulfillment,
    byChannel,
  };
}
