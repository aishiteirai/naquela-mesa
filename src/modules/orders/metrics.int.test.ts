import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { ensureUser } from "@/modules/auth";
import { getMenu, importCatalog } from "@/modules/catalog";
import { createStore, deleteStoreBySlug, setManualStatus } from "@/modules/stores";
import { db, pool } from "@/shared/db/client";
import { getStoreMetrics } from "./metrics";
import { resolvePeriod } from "./period";
import { transitionOrder } from "./queue";
import { orders } from "./schema";
import { createOrder } from "./service";

const TZ = "America/Sao_Paulo";
const ALL_TIME = { start: new Date("2000-01-01T00:00:00Z"), end: new Date("2100-01-01T00:00:00Z") };

async function setupStore(slug: string) {
  const { id: storeId } = await createStore({
    slug,
    name: slug,
    whatsappPhone: "+5511999990000",
    rules: { minOrderCents: 0, deliveryFee: { strategy: "fixed", fixedCents: 600 } },
  });
  await setManualStatus(storeId, "force_open");
  await importCatalog(storeId, {
    categories: [{ name: "Bebidas", products: [{ name: "Coca-Cola 2L", priceCents: 1400 }, { name: "Guaraná 2L", priceCents: 1000 }] }],
  });
  const products = (await getMenu(storeId)).categories[0]!.products;
  const id = (name: string) => products.find((product) => product.name === name)!.id;
  return { storeId, coca: id("Coca-Cola 2L"), guarana: id("Guaraná 2L") };
}

async function placeOrder(slug: string, productId: string, unitCents: number, quantity: number, fulfillment: "delivery" | "pickup") {
  const placed = await createOrder(slug, {
    idempotencyKey: randomUUID(),
    items: [{ kind: "simple", productId, optionIds: [], quantity, notes: null }],
    fulfillment,
    customer: { name: "Maria Silva", phone: "(11) 98888-7777" },
    address:
      fulfillment === "delivery"
        ? { street: "Rua A", number: "10", complement: null, neighborhood: "Centro", city: null, zipCode: null, reference: null }
        : null,
    tableLabel: null,
    payment: { method: fulfillment === "pickup" ? "on_pickup" : "cash", changeForCents: null },
    notes: null,
    expectedTotalCents: unitCents * quantity + (fulfillment === "delivery" ? 600 : 0),
  });
  return placed.orderId;
}

async function setCreatedAt(orderId: string, iso: string) {
  await db.update(orders).set({ createdAt: new Date(iso) }).where(eq(orders.id, orderId));
}

describe("métricas da loja", () => {
  let actor: { userId: string };

  beforeEach(async () => {
    await deleteStoreBySlug("metricas-a");
    await deleteStoreBySlug("metricas-b");
    const user = await ensureUser({ email: "dono-metricas@exemplo.com", password: "senha-forte-123", name: "Dono" });
    actor = { userId: user.id };
  });

  afterAll(async () => {
    await pool.end();
  });

  it("soma faturamento, ticket e rankings sem os cancelados", async () => {
    const a = await setupStore("metricas-a");
    await placeOrder("metricas-a", a.coca, 1400, 2, "pickup");
    await placeOrder("metricas-a", a.guarana, 1000, 1, "delivery");
    const cancelled = await placeOrder("metricas-a", a.coca, 1400, 1, "pickup");
    await transitionOrder(a.storeId, cancelled, "cancelled", { ...actor, cancelReason: "Cliente desistiu" });

    const metrics = await getStoreMetrics(a.storeId, ALL_TIME, TZ);

    expect(metrics).toMatchObject({ revenueCents: 4400, orderCount: 2, averageTicketCents: 2200, cancelledCount: 1 });
    expect(metrics.topProducts).toEqual([
      { name: "Coca-Cola 2L", quantity: 2, revenueCents: 2800 },
      { name: "Guaraná 2L", quantity: 1, revenueCents: 1000 },
    ]);
    expect(metrics.byFulfillment).toEqual([
      { fulfillment: "delivery", orders: 1, revenueCents: 1600 },
      { fulfillment: "pickup", orders: 1, revenueCents: 2800 },
    ]);
    expect(metrics.byChannel).toEqual([{ channel: "web", orders: 2, revenueCents: 4400 }]);
    expect(metrics.byHour.reduce((sum, bucket) => sum + bucket.orders, 0)).toBe(2);
  });

  it("separa dia e hora pelo fuso da loja", async () => {
    const a = await setupStore("metricas-a");
    const late = await placeOrder("metricas-a", a.coca, 1400, 1, "pickup");
    const early = await placeOrder("metricas-a", a.guarana, 1000, 1, "pickup");
    await setCreatedAt(late, "2026-10-13T02:30:00Z"); // 12/10 às 23:30 em São Paulo
    await setCreatedAt(early, "2026-10-13T03:30:00Z"); // 13/10 às 00:30 em São Paulo
    const now = new Date("2026-10-13T15:00:00Z");

    const today = resolvePeriod({ preset: "hoje" }, TZ, now);
    if (!today.ok) throw new Error(today.message);
    const todayMetrics = await getStoreMetrics(a.storeId, today.period, TZ);
    expect(todayMetrics.orderCount).toBe(1);
    expect(todayMetrics.byHour).toEqual([{ hour: 0, orders: 1 }]);
    expect(todayMetrics.topProducts.map((product) => product.name)).toEqual(["Guaraná 2L"]);

    const yesterday = resolvePeriod({ preset: "personalizado", from: "2026-10-12", to: "2026-10-12" }, TZ, now);
    if (!yesterday.ok) throw new Error(yesterday.message);
    const yesterdayMetrics = await getStoreMetrics(a.storeId, yesterday.period, TZ);
    expect(yesterdayMetrics.byHour).toEqual([{ hour: 23, orders: 1 }]);
    expect(yesterdayMetrics.topProducts.map((product) => product.name)).toEqual(["Coca-Cola 2L"]);
  });

  it("não mistura lojas e devolve zeros sem pedidos", async () => {
    const a = await setupStore("metricas-a");
    const b = await setupStore("metricas-b");
    await placeOrder("metricas-b", b.coca, 1400, 3, "pickup");

    expect(await getStoreMetrics(a.storeId, ALL_TIME, TZ)).toEqual({
      revenueCents: 0,
      orderCount: 0,
      averageTicketCents: 0,
      cancelledCount: 0,
      topProducts: [],
      byHour: [],
      byFulfillment: [],
      byChannel: [],
    });
  });
});
