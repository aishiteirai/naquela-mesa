import { afterAll, describe, expect, it } from "vitest";
import { getMenu } from "@/modules/catalog";
import { listOrderHistory, listQueue } from "@/modules/orders";
import { getMembershipStoreId, getStoreBySlug } from "@/modules/stores";
import { pool } from "@/shared/db/client";
import { DEMO_STORE_SLUG } from "../../scripts/demo/pizzaria-demo";
import { seedDemoStore } from "../../scripts/demo/seed";

describe("seedDemoStore", () => {
  afterAll(async () => {
    await pool.end();
  });

  it("cria a Pizzaria Demo completa e é idempotente", async () => {
    await seedDemoStore();
    const { storeId, ownerUserId } = await seedDemoStore();

    const store = await getStoreBySlug(DEMO_STORE_SLUG);
    expect(store?.id).toBe(storeId);
    expect(store?.name).toBe("Pizzaria Demo");
    expect(store?.hours).toHaveLength(6);

    const menu = await getMenu(storeId);
    expect(menu.categories.map((c) => c.name)).toEqual(["Pizzas Salgadas", "Pizzas Doces", "Bebidas", "Sobremesas"]);
    expect(menu.categories[0]?.sizes.map((s) => s.name)).toEqual(["Broto", "Média", "Grande"]);
    expect(menu.categories[0]?.products.find((p) => p.name === "Frango com Catupiry")?.available).toBe(false);
    expect(menu.optionGroups).toHaveLength(1);
    expect(await getMembershipStoreId(ownerUserId)).toBe(storeId);
  });

  it("gera histórico fictício só com pedidos antigos e finalizados", async () => {
    const { storeId, historyCount } = await seedDemoStore();
    expect(historyCount).toBeGreaterThan(60);

    const now = new Date();
    const history = await listOrderHistory(storeId, {
      start: new Date(now.getTime() - 40 * 86_400_000),
      end: now,
      status: null,
      search: null,
      page: 1,
      pageSize: 1000,
    });
    expect(history.total).toBe(historyCount);
    for (const order of history.orders) {
      expect(["completed", "cancelled"]).toContain(order.status);
      expect(Date.parse(order.createdAt)).toBeLessThan(now.getTime() - 24 * 3_600_000);
    }
    expect(history.orders.some((order) => order.status === "cancelled")).toBe(true);
    expect(history.orders.map((order) => order.number).sort((x, y) => x - y)).toEqual(
      Array.from({ length: historyCount }, (_, index) => index + 1),
    );
    expect(await listQueue(storeId)).toEqual([]);
  });
});
