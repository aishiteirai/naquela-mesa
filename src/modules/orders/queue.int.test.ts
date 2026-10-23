import { randomUUID } from "node:crypto";
import { asc, eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { getMenu, importCatalog } from "@/modules/catalog";
import { createStore, deleteStoreBySlug, setManualStatus } from "@/modules/stores";
import { ensureUser } from "@/modules/auth";
import { db, pool } from "@/shared/db/client";
import { getQueueVersion, getStoreOrder, listQueue, transitionOrder } from "./queue";
import { orderStatusEvents } from "./schema";
import { createOrder, getOrderTracking } from "./service";

async function setupStore(slug: string, features: { dineIn?: boolean } = {}) {
  const { id: storeId } = await createStore({
    slug,
    name: slug,
    whatsappPhone: "+5511999990000",
    features,
    rules: { minOrderCents: 0, deliveryFee: { strategy: "fixed", fixedCents: 600 } },
  });
  await setManualStatus(storeId, "force_open");
  await importCatalog(storeId, { categories: [{ name: "Bebidas", products: [{ name: "Coca-Cola 2L", priceCents: 1400 }] }] });
  const coca = (await getMenu(storeId)).categories[0]!.products[0]!.id;
  return { storeId, coca };
}

async function placeOrder(slug: string, coca: string, fulfillment: "delivery" | "pickup" = "pickup") {
  return createOrder(slug, {
    idempotencyKey: randomUUID(),
    items: [{ kind: "simple", productId: coca, optionIds: [], quantity: 2, notes: "bem gelada" }],
    fulfillment,
    customer: { name: "Maria Silva", phone: "(11) 98888-7777" },
    address:
      fulfillment === "delivery"
        ? { street: "Rua A", number: "10", complement: null, neighborhood: "Centro", city: null, zipCode: null, reference: null }
        : null,
    tableLabel: null,
    payment: { method: fulfillment === "pickup" ? "on_pickup" : "cash", changeForCents: null },
    notes: null,
    expectedTotalCents: fulfillment === "delivery" ? 3400 : 2800,
  });
}

describe("fila de pedidos", () => {
  let actor: { userId: string };

  beforeEach(async () => {
    await deleteStoreBySlug("fila-a");
    await deleteStoreBySlug("fila-b");
    const user = await ensureUser({ email: "dono-fila@exemplo.com", password: "senha-forte-123", name: "Dono" });
    actor = { userId: user.id };
  });

  afterAll(async () => {
    await pool.end();
  });

  it("lista pedidos com dados para o painel e muda a versão a cada evento", async () => {
    const a = await setupStore("fila-a");
    const v0 = await getQueueVersion(a.storeId);
    const placed = await placeOrder("fila-a", a.coca, "delivery");
    const v1 = await getQueueVersion(a.storeId);

    expect(v1.version).not.toBe(v0.version);
    expect(v1.received).toBe(1);
    expect(v1.total).toBe(v0.total + 1);

    const [order] = await listQueue(a.storeId);
    expect(order).toMatchObject({
      id: placed.orderId,
      number: 1,
      status: "received",
      fulfillment: "delivery",
      customerPhone: "+5511988887777",
      address: { street: "Rua A", neighborhood: "Centro" },
      totalCents: 3400,
      items: [{ description: "Coca-Cola 2L", quantity: 2, totalCents: 2800, options: [], notes: "bem gelada" }],
    });

    await transitionOrder(a.storeId, placed.orderId, "preparing", actor);
    const v2 = await getQueueVersion(a.storeId);
    expect(v2.version).not.toBe(v1.version);
    expect(v2.received).toBe(0);
    expect(v2.total).toBe(v1.total);
  });

  it("segue o fluxo da retirada até concluir", async () => {
    const a = await setupStore("fila-a");
    const { orderId } = await placeOrder("fila-a", a.coca);
    for (const status of ["preparing", "ready", "completed"] as const) {
      await transitionOrder(a.storeId, orderId, status, actor);
    }
    expect((await getStoreOrder(a.storeId, orderId)).status).toBe("completed");

    const events = await db.select().from(orderStatusEvents).where(eq(orderStatusEvents.orderId, orderId)).orderBy(asc(orderStatusEvents.at));
    expect(events.map((event) => event.status)).toEqual(["received", "preparing", "ready", "completed"]);
    expect(events.slice(1).every((event) => event.byUserId === actor.userId)).toBe(true);
  });

  it("recusa transição fora da ordem e a partir de final", async () => {
    const a = await setupStore("fila-a");
    const { orderId } = await placeOrder("fila-a", a.coca);
    await expect(transitionOrder(a.storeId, orderId, "completed", actor)).rejects.toMatchObject({ code: "INVALID_TRANSITION" });
    await expect(transitionOrder(a.storeId, orderId, "out_for_delivery", actor)).rejects.toMatchObject({ code: "INVALID_TRANSITION" });
    await transitionOrder(a.storeId, orderId, "cancelled", { ...actor, cancelReason: "cliente desistiu" });
    await expect(transitionOrder(a.storeId, orderId, "preparing", actor)).rejects.toMatchObject({ code: "INVALID_TRANSITION" });
  });

  it("cancelar exige motivo", async () => {
    const a = await setupStore("fila-a");
    const { orderId, publicToken } = await placeOrder("fila-a", a.coca);
    for (const reason of [undefined, null, "  ", "ab"]) {
      await expect(transitionOrder(a.storeId, orderId, "cancelled", { ...actor, cancelReason: reason })).rejects.toMatchObject({
        code: "VALIDATION",
        details: { issues: [{ path: "cancelReason" }] },
      });
    }
    await transitionOrder(a.storeId, orderId, "cancelled", { ...actor, cancelReason: "  acabou a massa  " });
    expect(await getStoreOrder(a.storeId, orderId)).toMatchObject({ status: "cancelled", cancelReason: "acabou a massa" });
    expect((await getOrderTracking(publicToken))?.cancelReason).toBe("acabou a massa");
  });

  it("dois aparelhos aceitando ao mesmo tempo: só um vence", async () => {
    const a = await setupStore("fila-a");
    const { orderId } = await placeOrder("fila-a", a.coca);
    const results = await Promise.allSettled([
      transitionOrder(a.storeId, orderId, "preparing", actor),
      transitionOrder(a.storeId, orderId, "preparing", actor),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((result) => result.status === "rejected") as PromiseRejectedResult;
    expect(rejected.reason).toMatchObject({ code: "INVALID_TRANSITION" });
    const events = await db.select().from(orderStatusEvents).where(eq(orderStatusEvents.orderId, orderId));
    expect(events.filter((event) => event.status === "preparing")).toHaveLength(1);
  });

  it("pedido de outra loja → NOT_FOUND e nada muda", async () => {
    const a = await setupStore("fila-a");
    const b = await setupStore("fila-b");
    const { orderId } = await placeOrder("fila-b", b.coca);

    await expect(transitionOrder(a.storeId, orderId, "preparing", actor)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(getStoreOrder(a.storeId, orderId)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await listQueue(a.storeId)).toEqual([]);
    expect((await getStoreOrder(b.storeId, orderId)).status).toBe("received");
  });

  it("finais antigos saem da fila; não finais antigos ficam", async () => {
    const a = await setupStore("fila-a");
    const done = await placeOrder("fila-a", a.coca);
    const open = await placeOrder("fila-a", a.coca);
    await transitionOrder(a.storeId, done.orderId, "cancelled", { ...actor, cancelReason: "teste antigo" });

    const tomorrow = new Date(Date.now() + 25 * 60 * 60 * 1000);
    expect((await listQueue(a.storeId, tomorrow)).map((order) => order.id)).toEqual([open.orderId]);
  });

  it("limite mantém os pedidos mais novos", async () => {
    const a = await setupStore("fila-a");
    await placeOrder("fila-a", a.coca);
    const second = await placeOrder("fila-a", a.coca);
    const third = await placeOrder("fila-a", a.coca);
    expect((await listQueue(a.storeId, new Date(), 2)).map((order) => order.id)).toEqual([second.orderId, third.orderId]);
  });

  it("consumo no local segue recebido → preparo → pronto → concluído", async () => {
    const a = await setupStore("fila-a", { dineIn: true });
    const placed = await createOrder("fila-a", {
      idempotencyKey: randomUUID(),
      items: [{ kind: "simple", productId: a.coca, optionIds: [], quantity: 1, notes: null }],
      fulfillment: "dine_in",
      customer: { name: "Maria Silva", phone: "(11) 98888-7777" },
      address: null,
      tableLabel: "Mesa 4",
      payment: { method: "cash", changeForCents: null },
      notes: null,
      expectedTotalCents: 1400,
    });

    await transitionOrder(a.storeId, placed.orderId, "preparing", actor);
    await expect(transitionOrder(a.storeId, placed.orderId, "out_for_delivery", actor)).rejects.toMatchObject({
      code: "INVALID_TRANSITION",
    });
    await transitionOrder(a.storeId, placed.orderId, "ready", actor);
    await transitionOrder(a.storeId, placed.orderId, "completed", actor);

    expect(await getStoreOrder(a.storeId, placed.orderId)).toMatchObject({
      status: "completed",
      fulfillment: "dine_in",
      tableLabel: "Mesa 4",
    });
  });
});
