import { and, asc, count, eq, gte, inArray, max, notInArray, or, sql } from "drizzle-orm";
import { db } from "@/shared/db/client";
import { DomainError } from "@/shared/errors";
import { describeLine } from "./pricing";
import { orderItemOptions, orderItems, orders, orderStatusEvents } from "./schema";
import { loadPlacedOrder, type PlacedOrder } from "./service";
import { canTransition, FINAL_STATUSES } from "./status";
import type { Fulfillment, OrderAddress, OrderStatus, PaymentMethod } from "./types";

export type QueueOrder = {
  id: string;
  number: number;
  status: OrderStatus;
  fulfillment: Fulfillment;
  customerName: string;
  customerPhone: string;
  address: OrderAddress | null;
  tableLabel: string | null;
  paymentMethod: PaymentMethod;
  changeForCents: number | null;
  notes: string | null;
  cancelReason: string | null;
  subtotalCents: number;
  deliveryFeeCents: number;
  totalCents: number;
  publicToken: string;
  createdAt: string;
  updatedAt: string;
  items: { description: string; quantity: number; totalCents: number; options: string[]; notes: string | null }[];
};

const QUEUE_LIMIT = 200;
const FINISHED_WINDOW_MS = 24 * 60 * 60 * 1000;
const FINAL = [...FINAL_STATUSES];

export async function listQueue(storeId: string, now: Date = new Date()): Promise<QueueOrder[]> {
  const since = new Date(now.getTime() - FINISHED_WINDOW_MS);
  const rows = await db
    .select()
    .from(orders)
    .where(and(eq(orders.storeId, storeId), or(notInArray(orders.status, FINAL), gte(orders.createdAt, since))))
    .orderBy(asc(orders.createdAt))
    .limit(QUEUE_LIMIT);
  if (rows.length === 0) return [];

  const orderIds = rows.map((row) => row.id);
  const items = await db.select().from(orderItems).where(inArray(orderItems.orderId, orderIds)).orderBy(asc(orderItems.position));
  const options =
    items.length === 0
      ? []
      : await db
          .select()
          .from(orderItemOptions)
          .where(
            inArray(
              orderItemOptions.orderItemId,
              items.map((item) => item.id),
            ),
          );

  return rows.map((row) => ({
    id: row.id,
    number: row.number,
    status: row.status,
    fulfillment: row.fulfillment,
    customerName: row.customerName,
    customerPhone: row.customerPhone,
    address: row.address,
    tableLabel: row.tableLabel,
    paymentMethod: row.paymentMethod,
    changeForCents: row.changeForCents,
    notes: row.notes,
    cancelReason: row.cancelReason,
    subtotalCents: row.subtotalCents,
    deliveryFeeCents: row.deliveryFeeCents,
    totalCents: row.totalCents,
    publicToken: row.publicToken,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    items: items
      .filter((item) => item.orderId === row.id)
      .map((item) => ({
        description: describeLine(item),
        quantity: item.quantity,
        totalCents: item.totalCents,
        notes: item.notes,
        options: options
          .filter((option) => option.orderItemId === item.id)
          .map((option) => `${option.groupName}: ${option.optionName}`),
      })),
  }));
}

export async function getQueueVersion(storeId: string): Promise<{ version: string; received: number }> {
  const [row] = await db
    .select({
      total: count(),
      lastUpdate: max(orders.updatedAt),
      received: sql<number>`count(*) filter (where ${orders.status} = 'received')`.mapWith(Number),
    })
    .from(orders)
    .where(eq(orders.storeId, storeId));
  return {
    version: `${row?.total ?? 0}:${row?.lastUpdate?.getTime() ?? 0}`,
    received: row?.received ?? 0,
  };
}

function invalid(path: string, message: string): DomainError {
  return new DomainError("VALIDATION", { issues: [{ path, message }] });
}

export async function transitionOrder(
  storeId: string,
  orderId: string,
  to: OrderStatus,
  actor: { userId: string; cancelReason?: string | null },
): Promise<void> {
  let cancelReason: string | null = null;
  if (to === "cancelled") {
    cancelReason = actor.cancelReason?.trim() ?? "";
    if (cancelReason.length < 3) throw invalid("cancelReason", "informe o motivo do cancelamento");
    if (cancelReason.length > 200) throw invalid("cancelReason", "motivo muito longo");
  }

  await db.transaction(async (tx) => {
    const [current] = await tx
      .select({ status: orders.status, fulfillment: orders.fulfillment })
      .from(orders)
      .where(and(eq(orders.id, orderId), eq(orders.storeId, storeId)))
      .limit(1);
    if (!current) throw new DomainError("NOT_FOUND");
    if (!canTransition(current.fulfillment, current.status, to)) {
      throw new DomainError("INVALID_TRANSITION", { from: current.status, to });
    }

    // Só atualiza se ninguém mudou o status desde a leitura (outro aparelho).
    const updated = await tx
      .update(orders)
      .set({ status: to, updatedAt: new Date(), ...(to === "cancelled" ? { cancelReason } : {}) })
      .where(and(eq(orders.id, orderId), eq(orders.storeId, storeId), eq(orders.status, current.status)))
      .returning({ id: orders.id });
    if (updated.length === 0) throw new DomainError("INVALID_TRANSITION", { from: current.status, to });

    await tx.insert(orderStatusEvents).values({ orderId, status: to, byUserId: actor.userId });
  });
}

export async function getStoreOrder(
  storeId: string,
  orderId: string,
): Promise<PlacedOrder & { status: OrderStatus; cancelReason: string | null; createdAt: string }> {
  const [row] = await db
    .select({ status: orders.status, cancelReason: orders.cancelReason, createdAt: orders.createdAt })
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.storeId, storeId)))
    .limit(1);
  if (!row) throw new DomainError("NOT_FOUND");
  const placed = await loadPlacedOrder(orderId);
  return { ...placed, status: row.status, cancelReason: row.cancelReason, createdAt: row.createdAt.toISOString() };
}
