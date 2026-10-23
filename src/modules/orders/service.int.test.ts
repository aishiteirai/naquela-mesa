import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { getMenu, importCatalog, setProductAvailability } from "@/modules/catalog";
import { createStore, deleteStoreBySlug, replaceDeliveryZones, setManualStatus, updateStoreOperations } from "@/modules/stores";
import { db, pool } from "@/shared/db/client";
import { orderItems, orders } from "./schema";
import { createOrder, getOrderTracking, quoteOrder } from "./service";

const SLUG = "pedido-teste";

async function setupStore(slug = SLUG) {
  const { id: storeId } = await createStore({
    slug,
    name: "Pedido Teste",
    whatsappPhone: "+5511999990000",
    rules: { minOrderCents: 3000, deliveryFee: { strategy: "fixed", fixedCents: 600 } },
    paymentMethods: { cash: true, cardOnDelivery: true, pixKey: null },
  });
  await setManualStatus(storeId, "force_open");
  await importCatalog(storeId, {
    optionGroups: [{ key: "borda", name: "Borda", minSelect: 0, maxSelect: 1, options: [{ name: "Catupiry", priceCents: 800 }] }],
    categories: [
      {
        name: "Pizzas",
        sizes: [
          { key: "broto", name: "Broto", maxFlavors: 1 },
          { key: "grande", name: "Grande", maxFlavors: 2 },
        ],
        products: [
          { name: "Calabresa", sizePrices: { broto: 3490, grande: 5690 }, allowsHalf: true, optionGroupKeys: ["borda"] },
          { name: "Mussarela", sizePrices: { broto: 3290, grande: 5490 }, allowsHalf: true, optionGroupKeys: ["borda"] },
        ],
      },
      {
        name: "Bebidas",
        products: [
          { name: "Coca-Cola 2L", priceCents: 1400 },
          { name: "Água", priceCents: 400 },
        ],
      },
    ],
  });
  const menu = await getMenu(storeId);
  const all = menu.categories.flatMap((category) => category.products);
  const productId = (name: string) => all.find((product) => product.name === name)!.id;
  const pizzas = menu.categories[0]!;
  return {
    storeId,
    calabresa: productId("Calabresa"),
    mussarela: productId("Mussarela"),
    coca: productId("Coca-Cola 2L"),
    agua: productId("Água"),
    grande: pizzas.sizes.find((size) => size.name === "Grande")!.id,
    catupiry: menu.optionGroups[0]!.options[0]!.id,
  };
}

type Ids = Awaited<ReturnType<typeof setupStore>>;

function checkout(ids: Ids, overrides: Record<string, unknown> = {}) {
  return {
    idempotencyKey: randomUUID(),
    items: [
      { kind: "sized", sizeId: ids.grande, flavorIds: [ids.calabresa, ids.mussarela], optionIds: [ids.catupiry], quantity: 1, notes: "sem cebola" },
      { kind: "simple", productId: ids.coca, optionIds: [], quantity: 1, notes: null },
    ],
    fulfillment: "delivery",
    customer: { name: "Maria Silva", phone: "(11) 98888-7777" },
    address: { street: "Rua A", number: "10", complement: null, neighborhood: "Centro", city: null, zipCode: null, reference: null },
    tableLabel: null,
    payment: { method: "cash", changeForCents: null },
    notes: null,
    expectedTotalCents: null,
    ...overrides,
  };
}

async function orderCount(storeId: string) {
  return (await db.select({ id: orders.id }).from(orders).where(eq(orders.storeId, storeId))).length;
}

describe("orders service", () => {
  beforeEach(async () => {
    await deleteStoreBySlug(SLUG);
    await deleteStoreBySlug("pedido-outra");
  });

  afterAll(async () => {
    await pool.end();
  });

  it("cota delivery com meio a meio, borda e taxa fixa", async () => {
    const ids = await setupStore();
    const quote = await quoteOrder(SLUG, checkout(ids));
    expect(quote).toMatchObject({ subtotalCents: 6490 + 1400, deliveryFeeCents: 600, totalCents: 8490 });
    expect(quote.lines[0]).toMatchObject({ sizeName: "Grande", flavors: ["Calabresa", "Mussarela"], unitPriceCents: 6490, notes: "sem cebola" });
  });

  it("retirada assume pagamento na retirada e o servidor amarra os dois", async () => {
    const ids = await setupStore();
    const pickup = { fulfillment: "pickup", address: null, payment: { method: "on_pickup", changeForCents: null } };
    await expect(quoteOrder(SLUG, checkout(ids, pickup))).resolves.toMatchObject({ deliveryFeeCents: 0 });
    await expect(
      quoteOrder(SLUG, checkout(ids, { ...pickup, payment: { method: "cash", changeForCents: null } })),
    ).rejects.toMatchObject({ code: "PAYMENT_DISABLED" });
    await expect(
      quoteOrder(SLUG, checkout(ids, { payment: { method: "on_pickup", changeForCents: null } })),
    ).rejects.toMatchObject({ code: "PAYMENT_DISABLED" });
  });

  it("cria pedido #1 com snapshot e acompanhamento sem dados pessoais", async () => {
    const ids = await setupStore();
    const placed = await createOrder(SLUG, checkout(ids, { expectedTotalCents: 8490 }));

    expect(placed).toMatchObject({ number: 1, totalCents: 8490, customerPhone: "+5511988887777", store: { slug: SLUG } });
    expect(placed.publicToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(placed.lines[0]!.options).toEqual([{ groupName: "Borda", optionName: "Catupiry", priceCents: 800 }]);

    await setProductAvailability(ids.storeId, ids.coca, false);
    const tracking = await getOrderTracking(placed.publicToken);
    expect(tracking).toMatchObject({
      number: 1,
      status: "received",
      customerFirstName: "Maria",
      totalCents: 8490,
      items: [
        { description: "Grande — ½ Calabresa + ½ Mussarela", quantity: 1, totalCents: 6490, options: ["Borda: Catupiry"] },
        { description: "Coca-Cola 2L", quantity: 1, totalCents: 1400, options: [] },
      ],
    });
    const serialized = JSON.stringify(tracking);
    expect(serialized).not.toContain("98888");
    expect(serialized).not.toContain("Rua A");
  });

  it("mesma idempotencyKey devolve o mesmo pedido", async () => {
    const ids = await setupStore();
    const input = checkout(ids, { expectedTotalCents: 8490 });
    const first = await createOrder(SLUG, input);
    const second = await createOrder(SLUG, input);
    expect(second.orderId).toBe(first.orderId);
    expect(await orderCount(ids.storeId)).toBe(1);
  });

  it("10 pedidos em paralelo recebem números 1..10", async () => {
    const ids = await setupStore();
    const placed = await Promise.all(Array.from({ length: 10 }, () => createOrder(SLUG, checkout(ids, { expectedTotalCents: 8490 }))));
    expect(placed.map((order) => order.number).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it("total diferente do esperado → PRICE_CHANGED e nada gravado", async () => {
    const ids = await setupStore();
    await expect(createOrder(SLUG, checkout(ids, { expectedTotalCents: 8000 }))).rejects.toMatchObject({
      code: "PRICE_CHANGED",
      details: { quote: { totalCents: 8490 } },
    });
    expect(await orderCount(ids.storeId)).toBe(0);
  });

  it("criar sem expectedTotalCents é recusado", async () => {
    const ids = await setupStore();
    await expect(createOrder(SLUG, checkout(ids))).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("revisão já recusa telefone inválido", async () => {
    const ids = await setupStore();
    await expect(quoteOrder(SLUG, checkout(ids, { customer: { name: "Maria", phone: "123" } }))).rejects.toMatchObject({
      code: "VALIDATION",
      details: { issues: [{ path: "customer.phone" }] },
    });
  });

  it("produto de outra loja ou esgotado → ITEM_UNAVAILABLE", async () => {
    const ids = await setupStore();
    const other = await setupStore("pedido-outra");
    await expect(
      quoteOrder(SLUG, checkout(ids, { items: [{ kind: "simple", productId: other.coca, optionIds: [], quantity: 3, notes: null }] })),
    ).rejects.toMatchObject({ code: "ITEM_UNAVAILABLE" });
    await setProductAvailability(ids.storeId, ids.agua, false);
    await expect(
      quoteOrder(SLUG, checkout(ids, { items: [{ kind: "simple", productId: ids.agua, optionIds: [], quantity: 10, notes: null }] })),
    ).rejects.toMatchObject({ code: "ITEM_UNAVAILABLE" });
  });

  it("regras da loja", async () => {
    const ids = await setupStore();
    const onlyCoca = { items: [{ kind: "simple", productId: ids.coca, optionIds: [], quantity: 1, notes: null }] };
    await expect(quoteOrder(SLUG, checkout(ids, onlyCoca))).rejects.toMatchObject({ code: "BELOW_MIN_ORDER", details: { minOrderCents: 3000 } });
    await expect(quoteOrder(SLUG, checkout(ids, { fulfillment: "dine_in", address: null, tableLabel: "5" }))).rejects.toMatchObject({ code: "FULFILLMENT_DISABLED" });
    await expect(quoteOrder(SLUG, checkout(ids, { payment: { method: "pix", changeForCents: null } }))).rejects.toMatchObject({ code: "PAYMENT_DISABLED" });
    await expect(quoteOrder(SLUG, checkout(ids, { payment: { method: "cash", changeForCents: 5000 } }))).rejects.toMatchObject({
      code: "VALIDATION",
      details: { issues: [{ path: "payment.changeForCents" }] },
    });
    await expect(createOrder(SLUG, checkout(ids, { customer: { name: "Ana", phone: "123" }, expectedTotalCents: 8490 }))).rejects.toMatchObject({
      code: "VALIDATION",
      details: { issues: [{ path: "customer.phone" }] },
    });
    await setManualStatus(ids.storeId, "force_closed");
    await expect(quoteOrder(SLUG, checkout(ids))).rejects.toMatchObject({ code: "STORE_CLOSED", details: { message: "Fechado no momento" } });
    await expect(quoteOrder("nao-existe", checkout(ids))).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("taxa por bairro ignora maiúsculas; bairro fora → ZONE_NOT_SERVED", async () => {
    const ids = await setupStore();
    await updateStoreOperations(ids.storeId, {
      features: { delivery: true, pickup: true },
      rules: { minOrderCents: 3000, deliveryFee: { strategy: "by_neighborhood" } },
      paymentMethods: { cash: true, cardOnDelivery: true, pixKey: null },
    });
    await replaceDeliveryZones(ids.storeId, [{ neighborhood: "Centro", feeCents: 500 }]);

    const address = { street: "Rua A", number: "10", complement: null, neighborhood: "  centro ", city: null, zipCode: null, reference: null };
    expect((await quoteOrder(SLUG, checkout(ids, { address }))).deliveryFeeCents).toBe(500);
    await expect(quoteOrder(SLUG, checkout(ids, { address: { ...address, neighborhood: "Vila Nova" } }))).rejects.toMatchObject({ code: "ZONE_NOT_SERVED" });
    expect((await quoteOrder(SLUG, checkout(ids, { fulfillment: "pickup", address: null, payment: { method: "on_pickup", changeForCents: null } }))).deliveryFeeCents).toBe(0);
  });

  it("mesma chave em paralelo grava um pedido e não consome número", async () => {
    const ids = await setupStore();
    const input = checkout(ids, { expectedTotalCents: 8490 });
    const placed = await Promise.all([createOrder(SLUG, input), createOrder(SLUG, input), createOrder(SLUG, input)]);
    expect(new Set(placed.map((order) => order.orderId)).size).toBe(1);
    expect(await orderCount(ids.storeId)).toBe(1);
    const next = await createOrder(SLUG, checkout(ids, { expectedTotalCents: 8490 }));
    expect(next.number).toBe(2);
  });

  it("total acima do teto → VALIDATION em items", async () => {
    const ids = await setupStore();
    await importCatalog(ids.storeId, { categories: [{ name: "Caros", products: [{ name: "Banquete", priceCents: 10_000_000 }] }] });
    const menu = await getMenu(ids.storeId);
    const banquete = menu.categories.flatMap((category) => category.products).find((product) => product.name === "Banquete")!.id;
    await expect(
      quoteOrder(SLUG, checkout(ids, { items: [{ kind: "simple", productId: banquete, optionIds: [], quantity: 11, notes: null }] })),
    ).rejects.toMatchObject({ code: "VALIDATION", details: { issues: [{ path: "items" }] } });
  });

  it("ids de outra loja são recusados", async () => {
    const ids = await setupStore();
    const other = await setupStore("pedido-outra");
    const sized = (overrides: Record<string, unknown>) => ({
      items: [{ kind: "sized", sizeId: ids.grande, flavorIds: [ids.calabresa], optionIds: [], quantity: 1, notes: null, ...overrides }],
    });
    await expect(quoteOrder(SLUG, checkout(ids, sized({ sizeId: other.grande })))).rejects.toMatchObject({ code: "ITEM_UNAVAILABLE" });
    await expect(quoteOrder(SLUG, checkout(ids, sized({ flavorIds: [other.calabresa] })))).rejects.toMatchObject({ code: "ITEM_UNAVAILABLE" });
    await expect(quoteOrder(SLUG, checkout(ids, sized({ optionIds: [other.catupiry] })))).rejects.toMatchObject({ code: "INVALID_OPTIONS" });
  });

  it("token inválido ou inexistente → null", async () => {
    expect(await getOrderTracking("abc")).toBeNull();
    expect(await getOrderTracking("A".repeat(43))).toBeNull();
  });

  it("o banco recusa item com quantidade ou valor inválido", async () => {
    const ids = await setupStore();
    const placed = await createOrder(SLUG, checkout(ids, { expectedTotalCents: 8490 }));
    const base = { orderId: placed.orderId, productName: "X", quantity: 1, unitPriceCents: 100, totalCents: 100 };
    await expect(db.insert(orderItems).values({ ...base, quantity: 0 })).rejects.toMatchObject({ cause: { constraint: "order_items_quantity_check" } });
    await expect(db.insert(orderItems).values({ ...base, quantity: 51 })).rejects.toMatchObject({ cause: { constraint: "order_items_quantity_check" } });
    await expect(db.insert(orderItems).values({ ...base, totalCents: -1 })).rejects.toMatchObject({ cause: { constraint: "order_items_amounts_check" } });
  });
});
