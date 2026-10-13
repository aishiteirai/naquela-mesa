import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createStore, deleteStoreBySlug } from "@/modules/stores";
import { db, pool } from "@/shared/db/client";
import type { CatalogDefinition } from "./definition";
import { categories, products } from "./schema";
import { getMenu, importCatalog } from "./service";

const pizzaria: CatalogDefinition = {
  optionGroups: [
    {
      key: "borda",
      name: "Borda",
      minSelect: 0,
      maxSelect: 1,
      options: [
        { name: "Catupiry", priceCents: 800 },
        { name: "Cheddar", priceCents: 800, available: false },
      ],
    },
  ],
  categories: [
    {
      name: "Pizzas",
      sizes: [
        { key: "broto", name: "Broto", maxFlavors: 1 },
        { key: "grande", name: "Grande", maxFlavors: 2 },
      ],
      products: [
        { name: "Mussarela", sizePrices: { grande: 5490, broto: 3290 }, allowsHalf: true, optionGroupKeys: ["borda"] },
        { name: "Calabresa", description: "Calabresa e cebola", sizePrices: { broto: 3490, grande: 5690 }, allowsHalf: true, available: false },
      ],
    },
    { name: "Bebidas", products: [{ name: "Coca-Cola 2L", priceCents: 1400 }] },
  ],
};

async function newStore(slug: string): Promise<string> {
  const { id } = await createStore({ slug, name: slug, whatsappPhone: "+5511988887777" });
  return id;
}

describe("catalog service", () => {
  beforeEach(async () => {
    // Apagar a loja remove o catálogo em cascata.
    await deleteStoreBySlug("loja-a");
    await deleteStoreBySlug("loja-b");
  });

  afterAll(async () => {
    await pool.end();
  });

  it("importa e devolve o cardápio ordenado com preços por tamanho", async () => {
    const storeId = await newStore("loja-a");
    await importCatalog(storeId, pizzaria);

    const menu = await getMenu(storeId);

    expect(menu.categories.map((c) => c.name)).toEqual(["Pizzas", "Bebidas"]);
    const pizzas = menu.categories[0]!;
    expect(pizzas.sizes.map((s) => [s.name, s.maxFlavors])).toEqual([["Broto", 1], ["Grande", 2]]);
    expect(pizzas.products.map((p) => p.name)).toEqual(["Mussarela", "Calabresa"]);

    const mussarela = pizzas.products[0]!;
    expect(mussarela.sizePrices).toEqual([
      { sizeId: pizzas.sizes[0]!.id, priceCents: 3290 },
      { sizeId: pizzas.sizes[1]!.id, priceCents: 5490 },
    ]);
    expect(mussarela).toMatchObject({ priceCents: null, allowsHalf: true, available: true, description: null });
    expect(mussarela.optionGroupIds).toEqual([menu.optionGroups[0]!.id]);
    expect(pizzas.products[1]).toMatchObject({ available: false, description: "Calabresa e cebola" });

    expect(menu.categories[1]!.products[0]).toMatchObject({ name: "Coca-Cola 2L", priceCents: 1400, sizePrices: [] });
    expect(menu.optionGroups[0]).toMatchObject({ name: "Borda", minSelect: 0, maxSelect: 1 });
    expect(menu.optionGroups[0]!.options.map((o) => [o.name, o.available])).toEqual([["Catupiry", true], ["Cheddar", false]]);
  });

  it("nunca mistura cardápio de outra loja", async () => {
    const storeA = await newStore("loja-a");
    const storeB = await newStore("loja-b");
    await importCatalog(storeA, pizzaria);
    await importCatalog(storeB, { categories: [{ name: "Lanches", products: [{ name: "X-Burger", priceCents: 2500 }] }] });

    const menuA = await getMenu(storeA);
    const menuB = await getMenu(storeB);

    expect(menuA.categories.flatMap((c) => c.products.map((p) => p.name))).not.toContain("X-Burger");
    expect(menuB.categories.map((c) => c.name)).toEqual(["Lanches"]);
    expect(menuB.optionGroups).toEqual([]);
  });

  it("esconde produto inativo, categoria inativa e categoria sem produto ativo", async () => {
    const storeId = await newStore("loja-a");
    await importCatalog(storeId, pizzaria);

    await db.update(products).set({ active: false }).where(eq(products.name, "Coca-Cola 2L"));
    await db.update(products).set({ active: false }).where(eq(products.name, "Calabresa"));
    let menu = await getMenu(storeId);
    expect(menu.categories.map((c) => c.name)).toEqual(["Pizzas"]);
    expect(menu.categories[0]!.products.map((p) => p.name)).toEqual(["Mussarela"]);

    await db.update(categories).set({ active: false }).where(eq(categories.name, "Pizzas"));
    menu = await getMenu(storeId);
    expect(menu.categories).toEqual([]);
  });

  it("definição inválida não grava nada", async () => {
    const storeId = await newStore("loja-a");
    const invalid = structuredClone(pizzaria);
    invalid.categories[0]!.products[0]!.sizePrices = { broto: 3290 };

    await expect(importCatalog(storeId, invalid)).rejects.toMatchObject({ code: "VALIDATION" });
    expect((await getMenu(storeId)).categories).toEqual([]);
  });
});
