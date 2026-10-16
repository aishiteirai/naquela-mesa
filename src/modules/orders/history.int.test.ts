import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { ensureUser } from "@/modules/auth";
import { getMenu, importCatalog } from "@/modules/catalog";
import { createStore, deleteStoreBySlug, setManualStatus } from "@/modules/stores";
import { db, pool } from "@/shared/db/client";
import { listOrderHistory, type OrderHistoryFilter } from "./history";
import { transitionOrder } from "./queue";
import { orders } from "./schema";
import { createOrder } from "./service";

const ALL: OrderHistoryFilter = {
  start: new Date("2000-01-01T00:00:00Z"),
  end: new Date("2100-01-01T00:00:00Z"),
  status: null,
  search: null,
  page: 1,
};

async function setupStore(slug: string) {
  const { id: storeId } = await createStore({
    slug,
    name: slug,
    whatsappPhone: "+5511999990000",
    rules: { minOrderCents: 0, deliveryFee: { strategy: "fixed", fixedCents: 600 } },
  });
  await setManualStatus(storeId, "force_open");
  await importCatalog(storeId, { categories: [{ name: "Bebidas", products: [{ name: "Coca-Cola 2L", priceCents: 1400 }] }] });
  const coca = (await getMenu(storeId)).categories[0]!.products[0]!.id;
  return { storeId, coca };
}

async function place(slug: string, coca: string, name: string, phone: string, createdAt: string) {
  const placed = await createOrder(slug, {
    idempotencyKey: randomUUID(),
    items: [{ kind: "simple", productId: coca, optionIds: [], quantity: 1, notes: null }],
    fulfillment: "pickup",
    customer: { name, phone },
    address: null,
    tableLabel: null,
    payment: { method: "cash", changeForCents: null },
    notes: null,
    expectedTotalCents: 1400,
  });
  await db.update(orders).set({ createdAt: new Date(createdAt) }).where(eq(orders.id, placed.orderId));
  return placed.orderId;
}

async function placeDelivery(slug: string, coca: string, name: string, phone: string, createdAt: string) {
  const placed = await createOrder(slug, {
    idempotencyKey: randomUUID(),
    items: [{ kind: "simple", productId: coca, optionIds: [], quantity: 1, notes: null }],
    fulfillment: "delivery",
    customer: { name, phone },
    address: { street: "Rua A", number: "1", complement: null, neighborhood: "Centro", city: null, zipCode: null, reference: null },
    tableLabel: null,
    payment: { method: "cash", changeForCents: null },
    notes: null,
    expectedTotalCents: 2000,
  });
  await db.update(orders).set({ createdAt: new Date(createdAt) }).where(eq(orders.id, placed.orderId));
  return placed.orderId;
}

const numbers = (page: { orders: { number: number }[] }) => page.orders.map((order) => order.number);

describe("histórico de pedidos", () => {
  let actor: { userId: string };
  let a: { storeId: string; coca: string };

  beforeEach(async () => {
    await deleteStoreBySlug("historico-a");
    await deleteStoreBySlug("historico-b");
    const user = await ensureUser({ email: "dono-historico@exemplo.com", password: "senha-forte-123", name: "Dono" });
    actor = { userId: user.id };
    a = await setupStore("historico-a");
    await place("historico-a", a.coca, "Maria Silva", "(11) 98888-7777", "2026-10-10T20:00:00Z");
    const second = await place("historico-a", a.coca, "João Souza", "(21) 97777-6666", "2026-10-11T20:00:00Z");
    await place("historico-a", a.coca, "Ana 100% Lima", "(11) 96666-5555", "2026-10-12T20:00:00Z");
    await transitionOrder(a.storeId, second, "cancelled", { ...actor, cancelReason: "Sem entregador" });
  });

  afterAll(async () => {
    await pool.end();
  });

  it("lista do mais novo ao mais antigo e filtra por período e status", async () => {
    const all = await listOrderHistory(a.storeId, ALL);
    expect(numbers(all)).toEqual([3, 2, 1]);
    expect(all).toMatchObject({ total: 3, page: 1, pageCount: 1 });
    expect(all.orders[0]).toMatchObject({ customerName: "Ana 100% Lima", status: "received", totalCents: 1400 });

    const oneDay = await listOrderHistory(a.storeId, {
      ...ALL,
      start: new Date("2026-10-11T00:00:00Z"),
      end: new Date("2026-10-12T00:00:00Z"),
    });
    expect(numbers(oneDay)).toEqual([2]);

    const cancelled = await listOrderHistory(a.storeId, { ...ALL, status: "cancelled" });
    expect(numbers(cancelled)).toEqual([2]);
    expect(cancelled.orders[0]?.cancelReason).toBe("Sem entregador");
  });

  it("busca por número, telefone e nome, sem curingas", async () => {
    expect(numbers(await listOrderHistory(a.storeId, { ...ALL, search: "#2" }))).toEqual([2]);
    expect(numbers(await listOrderHistory(a.storeId, { ...ALL, search: " 2 " }))).toEqual([2]);
    expect(numbers(await listOrderHistory(a.storeId, { ...ALL, search: "97777-6666" }))).toEqual([2]);
    expect(numbers(await listOrderHistory(a.storeId, { ...ALL, search: "maria" }))).toEqual([1]);
    expect(numbers(await listOrderHistory(a.storeId, { ...ALL, search: "100%" }))).toEqual([3]);
    expect(numbers(await listOrderHistory(a.storeId, { ...ALL, search: "_" }))).toEqual([]);
    expect(numbers(await listOrderHistory(a.storeId, { ...ALL, search: "1234567" }))).toEqual([]);
    expect(numbers(await listOrderHistory(a.storeId, { ...ALL, search: "   " }))).toEqual([3, 2, 1]);
  });

  it("filtra por tipo de pedido", async () => {
    await place("historico-a", a.coca, "Ana", "11999990001", "2026-10-10T20:00:00Z");
    await placeDelivery("historico-a", a.coca, "Bia", "11999990002", "2026-10-10T21:00:00Z");
    const delivery = await listOrderHistory(a.storeId, { ...ALL, fulfillment: "delivery" });
    expect(delivery.orders.map((o) => o.customerName)).toEqual(["Bia"]);
    const pickup = await listOrderHistory(a.storeId, { ...ALL, fulfillment: "pickup" });
    expect(pickup.total).toBe(4);
    expect(pickup.orders.map((o) => o.customerName)).not.toContain("Bia");
  });

  it("soma o total sem cancelados", async () => {
    const first = await place("historico-a", a.coca, "Ana", "11999990001", "2026-10-10T20:00:00Z");
    await place("historico-a", a.coca, "Bia", "11999990002", "2026-10-10T21:00:00Z");
    await transitionOrder(a.storeId, first, "cancelled", { ...actor, cancelReason: "teste" });
    const page = await listOrderHistory(a.storeId, ALL);
    expect(page.total).toBe(5);
    // beforeEach: Maria (ativo), João (cancelado), Ana 100% (ativo); teste: Ana (cancelado), Bia (ativo)
    expect(page.revenueCents).toBe(3 * 1400);
  });

  it("pagina, ajusta página fora do intervalo e não mistura lojas", async () => {
    const b = await setupStore("historico-b");
    await place("historico-b", b.coca, "Cliente B", "(11) 95555-4444", "2026-10-12T21:00:00Z");

    const first = await listOrderHistory(a.storeId, { ...ALL, pageSize: 2 });
    expect(numbers(first)).toEqual([3, 2]);
    expect(first).toMatchObject({ total: 3, page: 1, pageCount: 2 });

    const last = await listOrderHistory(a.storeId, { ...ALL, pageSize: 2, page: 99 });
    expect(numbers(last)).toEqual([1]);
    expect(last.page).toBe(2);

    const zero = await listOrderHistory(a.storeId, { ...ALL, pageSize: 2, page: Number.NaN });
    expect(zero.page).toBe(1);

    const otherStore = await listOrderHistory(b.storeId, ALL);
    expect(otherStore.orders.map((order) => order.customerName)).toEqual(["Cliente B"]);
  });
});
