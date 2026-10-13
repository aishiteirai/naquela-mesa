import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createStore, deleteStoreBySlug } from "@/modules/stores";
import { db, pool } from "@/shared/db/client";
import {
  createCategory,
  createSize,
  deleteSize,
  getCatalogForEditing,
  moveCategory,
  moveSize,
  updateCategory,
  updateSize,
} from "./editor";
import { products } from "./schema";
import { getMenu, importCatalog } from "./service";

async function newStore(slug: string): Promise<string> {
  const { id } = await createStore({ slug, name: slug, whatsappPhone: "+5511988887777" });
  return id;
}

describe("catalog editor — categorias e tamanhos", () => {
  beforeEach(async () => {
    await deleteStoreBySlug("loja-a");
    await deleteStoreBySlug("loja-b");
  });

  afterAll(async () => {
    await pool.end();
  });

  it("cria categorias no fim, renomeia, desativa e reordena", async () => {
    const storeId = await newStore("loja-a");
    const pizzas = await createCategory(storeId, { name: "Pizzas" });
    const bebidas = await createCategory(storeId, { name: "Bebidas" });

    await updateCategory(storeId, bebidas.id, { name: "Bebidas geladas", active: false });
    await moveCategory(storeId, bebidas.id, "up");

    const view = await getCatalogForEditing(storeId);
    expect(view.categories.map((c) => [c.name, c.active])).toEqual([
      ["Bebidas geladas", false],
      ["Pizzas", true],
    ]);
    expect(view.categories[1]!.id).toBe(pizzas.id);
  });

  it("mover na ponta não faz nada", async () => {
    const storeId = await newStore("loja-a");
    const only = await createCategory(storeId, { name: "Única" });
    await moveCategory(storeId, only.id, "up");
    expect((await getCatalogForEditing(storeId)).categories.map((c) => c.name)).toEqual(["Única"]);
  });

  it("valida nome", async () => {
    const storeId = await newStore("loja-a");
    await expect(createCategory(storeId, { name: "   " })).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("tamanhos: cria, edita, reordena e apaga (preços caem junto)", async () => {
    const storeId = await newStore("loja-a");
    await importCatalog(storeId, {
      categories: [
        {
          name: "Pizzas",
          sizes: [
            { key: "broto", name: "Broto", maxFlavors: 1 },
            { key: "grande", name: "Grande", maxFlavors: 2 },
          ],
          products: [{ name: "Mussarela", sizePrices: { broto: 3290, grande: 5490 }, allowsHalf: true }],
        },
      ],
    });
    let view = await getCatalogForEditing(storeId);
    const category = view.categories[0]!;
    const [broto, grande] = category.sizes;

    const media = await createSize(storeId, category.id, { name: "Média", maxFlavors: 2 });
    await updateSize(storeId, broto!.id, { name: "Pequena", maxFlavors: 1 });
    await moveSize(storeId, media.id, "up");
    await deleteSize(storeId, grande!.id);

    view = await getCatalogForEditing(storeId);
    expect(view.categories[0]!.sizes.map((s) => s.name)).toEqual(["Pequena", "Média"]);
    expect(view.categories[0]!.products[0]!.sizePrices).toEqual([{ sizeId: broto!.id, priceCents: 3290 }]);
  });

  it("leitura para edição inclui inativos; cardápio público não", async () => {
    const storeId = await newStore("loja-a");
    const hidden = await createCategory(storeId, { name: "Escondida" });
    await updateCategory(storeId, hidden.id, { name: "Escondida", active: false });

    expect((await getCatalogForEditing(storeId)).categories.map((c) => c.name)).toEqual(["Escondida"]);
    expect((await getMenu(storeId)).categories).toEqual([]);
  });

  it("ids de outra loja → NOT_FOUND sem alterar nada", async () => {
    const storeA = await newStore("loja-a");
    const storeB = await newStore("loja-b");
    const categoryB = await createCategory(storeB, { name: "Da B" });
    const sizeB = await createSize(storeB, categoryB.id, { name: "Grande", maxFlavors: 2 });

    await expect(updateCategory(storeA, categoryB.id, { name: "Invadida", active: true })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(moveCategory(storeA, categoryB.id, "up")).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(createSize(storeA, categoryB.id, { name: "X", maxFlavors: 1 })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(updateSize(storeA, sizeB.id, { name: "Invadido", maxFlavors: 1 })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(deleteSize(storeA, sizeB.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(moveSize(storeA, sizeB.id, "up")).rejects.toMatchObject({ code: "NOT_FOUND" });

    const viewB = await getCatalogForEditing(storeB);
    expect(viewB.categories[0]).toMatchObject({ name: "Da B", sizes: [{ name: "Grande", maxFlavors: 2 }] });
  });

  it("posições empatadas são desempatadas por nome", async () => {
    const storeId = await newStore("loja-a");
    await importCatalog(storeId, {
      categories: [{ name: "Bebidas", products: [{ name: "Suco", priceCents: 800 }, { name: "Agua", priceCents: 400 }] }],
    });
    // Simula dois cadastros simultâneos que ganharam a mesma posição.
    await db.update(products).set({ position: 0 }).where(eq(products.storeId, storeId));

    const names = (await getCatalogForEditing(storeId)).categories[0]!.products.map((product) => product.name);
    expect(names).toEqual(["Agua", "Suco"]);
  });
});
