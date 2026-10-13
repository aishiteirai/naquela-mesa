import { describe, expect, it } from "vitest";
import type { Menu } from "@/modules/catalog";
import { describeLine, priceCart, priceItem, type PricingContext } from "./pricing";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const SIZE_BROTO = id(1);
const SIZE_GRANDE = id(2);
const SIZE_DOCE = id(3);
const CALABRESA = id(10);
const MUSSARELA = id(11);
const PORTUGUESA = id(12);
const FRANGO = id(13);
const CHOCOLATE = id(14);
const COCA = id(20);
const AGUA = id(21);
const BORDA = id(30);
const MOLHO = id(31);
const CATUPIRY = id(40);
const CHEDDAR = id(41);
const CHOC_BORDA = id(42);
const MOLHO_EXTRA = id(43);

const menu: Menu = {
  categories: [
    {
      id: id(100),
      name: "Pizzas",
      sizes: [
        { id: SIZE_BROTO, name: "Broto", maxFlavors: 1 },
        { id: SIZE_GRANDE, name: "Grande", maxFlavors: 2 },
      ],
      products: [
        { id: CALABRESA, name: "Calabresa", description: null, imageUrl: null, priceCents: null, sizePrices: [{ sizeId: SIZE_BROTO, priceCents: 3490 }, { sizeId: SIZE_GRANDE, priceCents: 5690 }], allowsHalf: true, available: true, optionGroupIds: [BORDA] },
        { id: MUSSARELA, name: "Mussarela", description: null, imageUrl: null, priceCents: null, sizePrices: [{ sizeId: SIZE_BROTO, priceCents: 3290 }, { sizeId: SIZE_GRANDE, priceCents: 5491 }], allowsHalf: true, available: true, optionGroupIds: [BORDA, MOLHO] },
        { id: PORTUGUESA, name: "Portuguesa", description: null, imageUrl: null, priceCents: null, sizePrices: [{ sizeId: SIZE_GRANDE, priceCents: 6190 }], allowsHalf: false, available: true, optionGroupIds: [] },
        { id: FRANGO, name: "Frango", description: null, imageUrl: null, priceCents: null, sizePrices: [{ sizeId: SIZE_GRANDE, priceCents: 6190 }], allowsHalf: true, available: false, optionGroupIds: [] },
      ],
    },
    {
      id: id(101),
      name: "Doces",
      sizes: [{ id: SIZE_DOCE, name: "Broto doce", maxFlavors: 1 }],
      products: [
        { id: CHOCOLATE, name: "Chocolate", description: null, imageUrl: null, priceCents: null, sizePrices: [{ sizeId: SIZE_DOCE, priceCents: 3490 }], allowsHalf: false, available: true, optionGroupIds: [] },
      ],
    },
    {
      id: id(102),
      name: "Bebidas",
      sizes: [],
      products: [
        { id: COCA, name: "Coca-Cola 2L", description: null, imageUrl: null, priceCents: 1400, sizePrices: [], allowsHalf: false, available: true, optionGroupIds: [] },
        { id: AGUA, name: "Água", description: null, imageUrl: null, priceCents: 400, sizePrices: [], allowsHalf: false, available: false, optionGroupIds: [] },
      ],
    },
  ],
  optionGroups: [
    {
      id: BORDA,
      name: "Borda",
      minSelect: 0,
      maxSelect: 1,
      options: [
        { id: CATUPIRY, name: "Catupiry", priceCents: 800, available: true },
        { id: CHEDDAR, name: "Cheddar", priceCents: 800, available: false },
        { id: CHOC_BORDA, name: "Chocolate", priceCents: 1000, available: true },
      ],
    },
    { id: MOLHO, name: "Molho", minSelect: 1, maxSelect: 2, options: [{ id: MOLHO_EXTRA, name: "Molho extra", priceCents: 0, available: true }] },
  ],
};

const ctx: PricingContext = { menu, halfPriceRule: "highest", halfAndHalfEnabled: true, addonsEnabled: true };

const simple = (productId: string, quantity = 1, optionIds: string[] = []) => ({ kind: "simple" as const, productId, optionIds, quantity, notes: null });
const sized = (sizeId: string, flavorIds: string[], optionIds: string[] = [], quantity = 1) => ({ kind: "sized" as const, sizeId, flavorIds, optionIds, quantity, notes: null });

function errorOf(fn: () => unknown) {
  try {
    fn();
  } catch (error) {
    return error as { code: string; details: Record<string, unknown> };
  }
  throw new Error("esperava erro");
}

describe("priceItem", () => {
  it("produto simples × quantidade", () => {
    expect(priceItem(ctx, simple(COCA, 2), 0)).toMatchObject({ productName: "Coca-Cola 2L", sizeName: null, unitPriceCents: 1400, totalCents: 2800 });
  });

  it.each([1, 50])("aceita quantidade %d", (quantity) => {
    expect(priceItem(ctx, simple(COCA, quantity), 0).quantity).toBe(quantity);
  });

  it("observação do item é aparada; só espaços vira null", () => {
    expect(priceItem(ctx, { ...simple(COCA), notes: "  bem gelada  " }, 0).notes).toBe("bem gelada");
    expect(priceItem(ctx, { ...simple(COCA), notes: "   " }, 0).notes).toBeNull();
  });

  it("pizza inteira usa o preço do tamanho", () => {
    expect(priceItem(ctx, sized(SIZE_GRANDE, [CALABRESA]), 0)).toMatchObject({ productName: "Calabresa", sizeName: "Grande", flavors: ["Calabresa"], unitPriceCents: 5690 });
  });

  it("meio a meio pelo sabor mais caro", () => {
    expect(priceItem(ctx, sized(SIZE_GRANDE, [MUSSARELA, CALABRESA], [MOLHO_EXTRA]), 0).unitPriceCents).toBe(5690);
  });

  it("meio a meio pela média arredondada para cima", () => {
    expect(priceItem({ ...ctx, halfPriceRule: "average" }, sized(SIZE_GRANDE, [CALABRESA, MUSSARELA], [MOLHO_EXTRA]), 0).unitPriceCents).toBe(5591);
  });

  it("adicional soma ao preço e entra no snapshot", () => {
    const line = priceItem(ctx, sized(SIZE_GRANDE, [CALABRESA], [CATUPIRY], 2), 0);
    expect(line).toMatchObject({ unitPriceCents: 6490, totalCents: 12980, options: [{ groupName: "Borda", optionName: "Catupiry", priceCents: 800 }] });
  });

  it.each([
    ["produto com tamanhos pedido como simples", simple(CALABRESA), "INVALID_OPTIONS"],
    ["produto inexistente (outra loja)", simple(id(999)), "ITEM_UNAVAILABLE"],
    ["produto esgotado", simple(AGUA), "ITEM_UNAVAILABLE"],
    ["tamanho inexistente", sized(id(998), [CALABRESA]), "ITEM_UNAVAILABLE"],
    ["2 sabores no broto", sized(SIZE_BROTO, [CALABRESA, MUSSARELA]), "INVALID_OPTIONS"],
    ["sabor que não permite meio a meio", sized(SIZE_GRANDE, [CALABRESA, PORTUGUESA]), "INVALID_OPTIONS"],
    ["sabor repetido", sized(SIZE_GRANDE, [CALABRESA, CALABRESA]), "INVALID_OPTIONS"],
    ["sabor de outra categoria", sized(SIZE_GRANDE, [CHOCOLATE]), "ITEM_UNAVAILABLE"],
    ["sabor esgotado", sized(SIZE_GRANDE, [CALABRESA, FRANGO]), "ITEM_UNAVAILABLE"],
    ["sabor sem preço no tamanho", sized(SIZE_BROTO, [PORTUGUESA]), "ITEM_UNAVAILABLE"],
    ["opção esgotada", sized(SIZE_GRANDE, [CALABRESA], [CHEDDAR]), "ITEM_UNAVAILABLE"],
    ["duas opções num grupo de máximo 1", sized(SIZE_GRANDE, [CALABRESA], [CATUPIRY, CHOC_BORDA]), "INVALID_OPTIONS"],
    ["opção de grupo não ligado ao produto", simple(COCA, 1, [CATUPIRY]), "INVALID_OPTIONS"],
    ["grupo obrigatório sem escolha", sized(SIZE_GRANDE, [MUSSARELA]), "INVALID_OPTIONS"],
  ])("recusa %s", (_label, item, code) => {
    expect(errorOf(() => priceItem(ctx, item, 3))).toMatchObject({ code, details: { itemIndex: 3 } });
  });

  it("meio a meio desligado na loja", () => {
    expect(errorOf(() => priceItem({ ...ctx, halfAndHalfEnabled: false }, sized(SIZE_GRANDE, [CALABRESA, MUSSARELA], [MOLHO_EXTRA]), 0)).code).toBe("INVALID_OPTIONS");
  });

  it("adicionais desligados: recusa opção e ignora grupos obrigatórios", () => {
    const off = { ...ctx, addonsEnabled: false };
    expect(errorOf(() => priceItem(off, sized(SIZE_GRANDE, [CALABRESA], [CATUPIRY]), 0)).code).toBe("INVALID_OPTIONS");
    expect(priceItem(off, sized(SIZE_GRANDE, [MUSSARELA]), 0).unitPriceCents).toBe(5491);
  });

  it.each([0, 51, 1.5])("recusa quantidade %s", (quantity) => {
    expect(errorOf(() => priceItem(ctx, simple(COCA, quantity), 2))).toMatchObject({
      code: "VALIDATION",
      details: { issues: [{ path: "items.2.quantity" }] },
    });
  });
});

describe("priceCart", () => {
  it("soma as linhas", () => {
    const { lines, subtotalCents } = priceCart(ctx, [simple(COCA), sized(SIZE_GRANDE, [CALABRESA], [CATUPIRY])]);
    expect(lines).toHaveLength(2);
    expect(subtotalCents).toBe(1400 + 6490);
  });

  it("sacola vazia", () => {
    expect(errorOf(() => priceCart(ctx, []))).toMatchObject({ code: "VALIDATION", details: { issues: [{ path: "items" }] } });
  });
});

describe("describeLine", () => {
  it.each([
    [{ productName: "Coca-Cola 2L", sizeName: null, flavors: [] }, "Coca-Cola 2L"],
    [{ productName: "Calabresa", sizeName: "Grande", flavors: ["Calabresa"] }, "Calabresa (Grande)"],
    [{ productName: "Calabresa / Mussarela", sizeName: "Grande", flavors: ["Calabresa", "Mussarela"] }, "Grande — ½ Calabresa + ½ Mussarela"],
  ])("%o → %s", (line, text) => {
    expect(describeLine(line)).toBe(text);
  });
});
