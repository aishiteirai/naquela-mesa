import { describe, expect, it } from "vitest";
import type { MenuCategory, MenuProduct } from "@/modules/catalog";
import { findOpenableProduct } from "./find-open-product";

function product(id: string, available = true): MenuProduct {
  return { id, name: id, description: null, imageUrl: null, priceCents: 1000, sizePrices: [], allowsHalf: false, available, optionGroupIds: [] };
}

const categories: MenuCategory[] = [
  { id: "c1", name: "Pizzas", sizes: [], products: [product("p1"), product("p2", false)] },
  { id: "c2", name: "Bebidas", sizes: [], products: [product("p3")] },
];

describe("findOpenableProduct", () => {
  it("devolve o produto disponível", () => {
    expect(findOpenableProduct("p3", categories)?.id).toBe("p3");
  });

  it("ignora produto esgotado", () => {
    expect(findOpenableProduct("p2", categories)).toBeNull();
  });

  it("ignora id inexistente", () => {
    expect(findOpenableProduct("nao-existe", categories)).toBeNull();
  });

  it("ignora parâmetro ausente", () => {
    expect(findOpenableProduct(null, categories)).toBeNull();
  });
});
