import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createStore, deleteStoreBySlug } from "@/modules/stores";
import { pool } from "@/shared/db/client";
import { createCategory, createSize, getCatalogForEditing } from "./editor";
import {
  addOption,
  createOptionGroup,
  createProduct,
  moveProduct,
  setOptionAvailability,
  setProductAvailability,
  updateOption,
  updateOptionGroup,
  updateProduct,
  type ProductInput,
} from "./editor-products";

async function newStore(slug: string): Promise<string> {
  const { id } = await createStore({ slug, name: slug, whatsappPhone: "+5511988887777" });
  return id;
}

async function pizzaSetup(storeId: string) {
  const category = await createCategory(storeId, { name: "Pizzas" });
  const broto = await createSize(storeId, category.id, { name: "Broto", maxFlavors: 1 });
  const grande = await createSize(storeId, category.id, { name: "Grande", maxFlavors: 2 });
  const borda = await createOptionGroup(storeId, { name: "Borda", minSelect: 0, maxSelect: 1 });
  return { categoryId: category.id, brotoId: broto.id, grandeId: grande.id, bordaId: borda.id };
}

function pizza(overrides: Partial<ProductInput> & Pick<ProductInput, "categoryId">): ProductInput {
  return {
    name: "Calabresa",
    description: "Calabresa e cebola",
    imageUrl: null,
    priceCents: null,
    sizePrices: [],
    allowsHalf: false,
    active: true,
    optionGroupIds: [],
    ...overrides,
  };
}

describe("catalog editor — produtos e adicionais", () => {
  beforeEach(async () => {
    await deleteStoreBySlug("loja-a");
    await deleteStoreBySlug("loja-b");
  });

  afterAll(async () => {
    await pool.end();
  });

  it("cria produto com preços por tamanho, meio a meio e borda; depois edita", async () => {
    const storeId = await newStore("loja-a");
    const s = await pizzaSetup(storeId);

    const { id } = await createProduct(
      storeId,
      pizza({
        categoryId: s.categoryId,
        sizePrices: [
          { sizeId: s.grandeId, priceCents: 5690 },
          { sizeId: s.brotoId, priceCents: 3490 },
        ],
        allowsHalf: true,
        optionGroupIds: [s.bordaId],
      }),
    );
    await updateProduct(
      storeId,
      id,
      pizza({
        categoryId: s.categoryId,
        name: "Calabresa especial",
        sizePrices: [{ sizeId: s.brotoId, priceCents: 3990 }],
        allowsHalf: false,
      }),
    );

    const product = (await getCatalogForEditing(storeId)).categories[0]!.products[0]!;
    expect(product).toMatchObject({
      id,
      name: "Calabresa especial",
      priceCents: null,
      sizePrices: [{ sizeId: s.brotoId, priceCents: 3990 }],
      allowsHalf: false,
      optionGroupIds: [],
      active: true,
      available: true,
    });
  });

  it("produto de categoria sem tamanhos exige priceCents", async () => {
    const storeId = await newStore("loja-a");
    const bebidas = await createCategory(storeId, { name: "Bebidas" });

    await expect(createProduct(storeId, pizza({ categoryId: bebidas.id, name: "Coca" }))).rejects.toMatchObject({
      code: "VALIDATION",
      details: { issues: [{ path: "priceCents" }] },
    });
    const ok = await createProduct(storeId, pizza({ categoryId: bebidas.id, name: "Coca", priceCents: 1400 }));
    expect(ok.id).toBeTruthy();
  });

  it.each([
    ["sem nenhum preço", { sizePrices: [] }, "sizePrices"],
    ["com priceCents", { priceCents: 1000 }, "sizePrices"],
    ["meio a meio sem tamanho de 2 sabores", { allowsHalf: true }, "allowsHalf"],
  ])("recusa pizza %s", async (_label, overrides, path) => {
    const storeId = await newStore("loja-a");
    const category = await createCategory(storeId, { name: "Pizzas" });
    const broto = await createSize(storeId, category.id, { name: "Broto", maxFlavors: 1 });
    const input = pizza({ categoryId: category.id, sizePrices: [{ sizeId: broto.id, priceCents: 3490 }], ...overrides });

    await expect(createProduct(storeId, input)).rejects.toMatchObject({
      code: "VALIDATION",
      details: { issues: [{ path }] },
    });
  });

  it("recusa tamanho repetido e tamanho de outra categoria", async () => {
    const storeId = await newStore("loja-a");
    const s = await pizzaSetup(storeId);
    const doces = await createCategory(storeId, { name: "Doces" });
    const doceBroto = await createSize(storeId, doces.id, { name: "Broto", maxFlavors: 1 });

    for (const sizePrices of [
      [
        { sizeId: s.brotoId, priceCents: 3490 },
        { sizeId: s.brotoId, priceCents: 3590 },
      ],
      [{ sizeId: doceBroto.id, priceCents: 3490 }],
    ]) {
      await expect(createProduct(storeId, pizza({ categoryId: s.categoryId, sizePrices }))).rejects.toMatchObject({
        code: "VALIDATION",
        details: { issues: [{ path: "sizePrices" }] },
      });
    }
  });

  it("disponibilidade e ordem de produtos", async () => {
    const storeId = await newStore("loja-a");
    const bebidas = await createCategory(storeId, { name: "Bebidas" });
    const coca = await createProduct(storeId, pizza({ categoryId: bebidas.id, name: "Coca", priceCents: 1400 }));
    const agua = await createProduct(storeId, pizza({ categoryId: bebidas.id, name: "Água", priceCents: 400 }));

    await setProductAvailability(storeId, coca.id, false);
    await moveProduct(storeId, agua.id, "up");

    const products = (await getCatalogForEditing(storeId)).categories[0]!.products;
    expect(products.map((p) => [p.name, p.available])).toEqual([
      ["Água", true],
      ["Coca", false],
    ]);
  });

  it("grupos e opções de adicionais", async () => {
    const storeId = await newStore("loja-a");
    const group = await createOptionGroup(storeId, { name: "Borda", minSelect: 0, maxSelect: 1 });
    const catupiry = await addOption(storeId, group.id, { name: "Catupiry", priceCents: 800, available: true });
    await addOption(storeId, group.id, { name: "Cheddar", priceCents: 800, available: true });

    await updateOptionGroup(storeId, group.id, { name: "Borda recheada", minSelect: 0, maxSelect: 2 });
    await updateOption(storeId, catupiry.id, { name: "Catupiry original", priceCents: 900, available: true });
    await setOptionAvailability(storeId, catupiry.id, false);

    const [view] = (await getCatalogForEditing(storeId)).optionGroups;
    expect(view).toMatchObject({ name: "Borda recheada", minSelect: 0, maxSelect: 2 });
    expect(view!.options.map((o) => [o.name, o.priceCents, o.available])).toEqual([
      ["Catupiry original", 900, false],
      ["Cheddar", 800, true],
    ]);
    await expect(createOptionGroup(storeId, { name: "X", minSelect: 2, maxSelect: 1 })).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("ids de outra loja → NOT_FOUND/VALIDATION sem alterar nada", async () => {
    const storeA = await newStore("loja-a");
    const storeB = await newStore("loja-b");
    const a = await pizzaSetup(storeA);
    const b = await pizzaSetup(storeB);
    const bebidasB = await createCategory(storeB, { name: "Bebidas" });
    const cocaB = await createProduct(storeB, pizza({ categoryId: bebidasB.id, name: "Coca B", priceCents: 1400 }));
    const optionB = await addOption(storeB, b.bordaId, { name: "Cheddar B", priceCents: 800, available: true });

    await expect(createProduct(storeA, pizza({ categoryId: bebidasB.id, priceCents: 1 }))).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(updateProduct(storeA, cocaB.id, pizza({ categoryId: a.categoryId, sizePrices: [{ sizeId: a.brotoId, priceCents: 1 }] }))).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(setProductAvailability(storeA, cocaB.id, false)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(moveProduct(storeA, cocaB.id, "up")).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      createProduct(storeA, pizza({ categoryId: a.categoryId, sizePrices: [{ sizeId: b.brotoId, priceCents: 1 }] })),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(
      createProduct(storeA, pizza({ categoryId: a.categoryId, sizePrices: [{ sizeId: a.brotoId, priceCents: 1 }], optionGroupIds: [b.bordaId] })),
    ).rejects.toMatchObject({ code: "VALIDATION", details: { issues: [{ path: "optionGroupIds" }] } });
    await expect(updateOptionGroup(storeA, b.bordaId, { name: "Invadido", minSelect: 0, maxSelect: 1 })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(addOption(storeA, b.bordaId, { name: "X", priceCents: 0, available: true })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(updateOption(storeA, optionB.id, { name: "Invadido", priceCents: 0, available: true })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(setOptionAvailability(storeA, optionB.id, false)).rejects.toMatchObject({ code: "NOT_FOUND" });

    const viewB = await getCatalogForEditing(storeB);
    expect(viewB.categories.find((c) => c.name === "Bebidas")!.products[0]).toMatchObject({ name: "Coca B", available: true });
    expect(viewB.optionGroups[0]).toMatchObject({ name: "Borda", options: [{ name: "Cheddar B", available: true }] });
  });
});
