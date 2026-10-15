import { describe, expect, it } from "vitest";
import type { MenuCategory, MenuProduct } from "@/modules/catalog";
import { parseItemParam } from "./item-param";

function product(id: string, available = true): MenuProduct {
  return { id, name: id, description: null, imageUrl: null, priceCents: 1000, sizePrices: [], allowsHalf: false, available, optionGroupIds: [] };
}

const categories: MenuCategory[] = [
  { id: "c1", name: "Pizzas", sizes: [], products: [product("p1"), product("p2", false)] },
  { id: "c2", name: "Bebidas", sizes: [], products: [product("p3")] },
];

describe("parseItemParam", () => {
  it("devolve o produto disponível", () => {
    expect(parseItemParam("p3", categories)?.id).toBe("p3");
  });

  it("ignora produto esgotado", () => {
    expect(parseItemParam("p2", categories)).toBeNull();
  });

  it("ignora id inexistente", () => {
    expect(parseItemParam("nao-existe", categories)).toBeNull();
  });

  it("ignora parâmetro ausente", () => {
    expect(parseItemParam(null, categories)).toBeNull();
  });
});
