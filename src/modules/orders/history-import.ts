import { randomBytes, randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "@/shared/db/client";
import type { PricedLine } from "./pricing";
import { orderCounters, orders, orderStatusEvents } from "./schema";
import { insertOrderLines } from "./service";
import type { Fulfillment, OrderAddress, OrderStatus, PaymentMethod } from "./types";

export type HistoricalOrder = {
  createdAt: Date;
  status: "completed" | "cancelled";
  cancelReason: string | null;
  fulfillment: Fulfillment;
  customerName: string;
  customerPhone: string;
  address: OrderAddress | null;
  tableLabel: string | null;
  paymentMethod: PaymentMethod;
  changeForCents: number | null;
  lines: PricedLine[];
  deliveryFeeCents: number;
};

const MINUTE = 60_000;

function statusTimeline(entry: HistoricalOrder): { status: OrderStatus; at: Date }[] {
  const at = (minutes: number) => new Date(entry.createdAt.getTime() + minutes * MINUTE);
  if (entry.status === "cancelled") {
    return [
      { status: "received", at: at(0) },
      { status: "cancelled", at: at(5) },
    ];
  }
  return [
    { status: "received", at: at(0) },
    { status: "preparing", at: at(3) },
    { status: entry.fulfillment === "delivery" ? "out_for_delivery" : "ready", at: at(30) },
    { status: "completed", at: at(45) },
  ];
}

/**
 * Só para seed/demonstração: grava pedidos antigos já finalizados, sem validar cardápio, horário nem preço.
 * Nunca usar em request de cliente.
 */
export async function importOrderHistory(storeId: string, history: HistoricalOrder[]): Promise<number> {
  if (process.env.NODE_ENV === "production") throw new Error("importOrderHistory não roda com NODE_ENV=production");
  const chronological = [...history].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  for (const entry of chronological) {
    const timeline = statusTimeline(entry);
    const subtotalCents = entry.lines.reduce((sum, line) => sum + line.totalCents, 0);

    await db.transaction(async (tx) => {
      const [counter] = await tx
        .insert(orderCounters)
        .values({ storeId, lastNumber: 1 })
        .onConflictDoUpdate({ target: orderCounters.storeId, set: { lastNumber: sql`${orderCounters.lastNumber} + 1` } })
        .returning({ lastNumber: orderCounters.lastNumber });

      const [order] = await tx
        .insert(orders)
        .values({
          storeId,
          number: counter!.lastNumber,
          publicToken: randomBytes(32).toString("base64url"),
          idempotencyKey: randomUUID(),
          channel: "web",
          status: entry.status,
          fulfillment: entry.fulfillment,
          customerName: entry.customerName,
          customerPhone: entry.customerPhone,
          address: entry.fulfillment === "delivery" ? entry.address : null,
          tableLabel: entry.fulfillment === "dine_in" ? entry.tableLabel : null,
          paymentMethod: entry.paymentMethod,
          changeForCents: entry.paymentMethod === "cash" ? entry.changeForCents : null,
          notes: null,
          cancelReason: entry.status === "cancelled" ? entry.cancelReason : null,
          subtotalCents,
          deliveryFeeCents: entry.deliveryFeeCents,
          totalCents: subtotalCents + entry.deliveryFeeCents,
          createdAt: entry.createdAt,
          updatedAt: timeline[timeline.length - 1]!.at,
        })
        .returning({ id: orders.id });

      await insertOrderLines(tx, order!.id, entry.lines);
      await tx.insert(orderStatusEvents).values(timeline.map((event) => ({ orderId: order!.id, status: event.status, at: event.at })));
    });
  }
  return chronological.length;
}
