import { afterAll, describe, expect, it } from "vitest";
import { getMenu } from "@/modules/catalog";
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
});
