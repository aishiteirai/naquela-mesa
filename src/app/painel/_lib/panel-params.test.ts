import { describe, expect, it } from "vitest";
import type { EditorCategory, EditorProduct } from "@/modules/catalog";
import { parsePanelParams } from "./panel-params";

function product(id: string, categoryId: string): EditorProduct {
  return {
    id,
    categoryId,
    name: id,
    description: null,
    imageUrl: null,
    priceCents: 1000,
    sizePrices: [],
    allowsHalf: false,
    available: true,
    active: true,
    optionGroupIds: [],
  };
}

const categories: EditorCategory[] = [
  { id: "c1", name: "Pizzas", active: true, sizes: [], products: [product("p1", "c1")] },
  { id: "c2", name: "Bebidas", active: true, sizes: [], products: [product("p2", "c2")] },
];

const none = { categoria: null, produto: null, novo: null };

describe("parsePanelParams", () => {
  it("sem parâmetros seleciona a primeira categoria", () => {
    expect(parsePanelParams(none, categories)).toEqual({ categoryId: "c1", productId: null, newInCategoryId: null });
  });

  it("categoria válida é selecionada", () => {
    expect(parsePanelParams({ ...none, categoria: "c2" }, categories).categoryId).toBe("c2");
  });

  it("categoria inválida volta para a primeira", () => {
    expect(parsePanelParams({ ...none, categoria: "x" }, categories).categoryId).toBe("c1");
  });

  it("produto aberto seleciona a categoria dele, mesmo com outra categoria na URL", () => {
    expect(parsePanelParams({ categoria: "c1", produto: "p2", novo: null }, categories)).toEqual({
      categoryId: "c2",
      productId: "p2",
      newInCategoryId: null,
    });
  });

  it("produto inexistente é ignorado", () => {
    expect(parsePanelParams({ categoria: "c2", produto: "x", novo: null }, categories)).toEqual({
      categoryId: "c2",
      productId: null,
      newInCategoryId: null,
    });
  });

  it("novo com categoria válida abre o produto novo nela", () => {
    expect(parsePanelParams({ ...none, novo: "c2" }, categories)).toEqual({ categoryId: "c2", productId: null, newInCategoryId: "c2" });
  });

  it("novo inválido é ignorado", () => {
    expect(parsePanelParams({ categoria: "c2", produto: null, novo: "x" }, categories)).toEqual({
      categoryId: "c2",
      productId: null,
      newInCategoryId: null,
    });
  });

  it("produto vence novo", () => {
    expect(parsePanelParams({ categoria: null, produto: "p1", novo: "c2" }, categories).newInCategoryId).toBeNull();
  });

  it("sem categorias não seleciona nada", () => {
    expect(parsePanelParams(none, [])).toEqual({ categoryId: null, productId: null, newInCategoryId: null });
  });
});
