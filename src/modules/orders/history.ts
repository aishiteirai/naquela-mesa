import { and, count, desc, eq, gte, ilike, like, lt, sql, type SQL } from "drizzle-orm";
import { db } from "@/shared/db/client";
import { hydrateOrders, type QueueOrder } from "./queue";
import { orders } from "./schema";
import type { Fulfillment, OrderStatus } from "./types";

export const HISTORY_PAGE_SIZE = 50;

export type OrderHistoryFilter = {
  start: Date;
  end: Date;
  status: OrderStatus | null;
  fulfillment?: Fulfillment | null;
  search: string | null;
  page: number;
  pageSize?: number;
};

export type OrderHistoryPage = {
  orders: QueueOrder[];
  total: number;
  revenueCents: number;
  page: number;
  pageCount: number;
};

const ORDER_NUMBER = /^#?(\d{1,6})$/;
const PHONE_LIKE = /^[\d\s()+-]+$/;

function searchCondition(search: string | null): SQL | undefined {
  const term = search?.trim() ?? "";
  if (!term) return undefined;

  const numberMatch = ORDER_NUMBER.exec(term);
  if (numberMatch) return eq(orders.number, Number(numberMatch[1]));

  const digits = term.replace(/\D/g, "");
  if (PHONE_LIKE.test(term) && digits.length >= 8) return like(orders.customerPhone, `%${digits}%`);

  // Escapa curingas do LIKE: "%" e "_" digitados são texto, não padrão.
  return ilike(orders.customerName, `%${term.replace(/[\\%_]/g, "\\$&")}%`);
}

export async function listOrderHistory(storeId: string, filter: OrderHistoryFilter): Promise<OrderHistoryPage> {
  const pageSize = filter.pageSize ?? HISTORY_PAGE_SIZE;
  const where = and(
    eq(orders.storeId, storeId),
    gte(orders.createdAt, filter.start),
    lt(orders.createdAt, filter.end),
    filter.status ? eq(orders.status, filter.status) : undefined,
    filter.fulfillment ? eq(orders.fulfillment, filter.fulfillment) : undefined,
    searchCondition(filter.search),
  );

  const [counted] = await db
    .select({
      total: count(),
      revenue: sql<string | null>`sum(${orders.totalCents}) filter (where ${orders.status} <> 'cancelled')`,
    })
    .from(orders)
    .where(where);
  const total = counted?.total ?? 0;
  const revenueCents = Number(counted?.revenue ?? 0);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const requested = Number.isFinite(filter.page) ? Math.floor(filter.page) : 1;
  const page = Math.min(Math.max(1, requested), pageCount);

  const rows = await db
    .select()
    .from(orders)
    .where(where)
    .orderBy(desc(orders.createdAt), desc(orders.number))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  return { orders: await hydrateOrders(rows), total, revenueCents, page, pageCount };
}
