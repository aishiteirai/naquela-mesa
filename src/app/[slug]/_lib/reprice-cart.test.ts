import { describe, expect, it } from "vitest";
import type { Menu } from "@/modules/catalog";
import type { PricingContext } from "@/modules/orders/client";
import type { CartLine } from "@/app/[slug]/_components/cart-storage";
import { repriceCart } from "./reprice-cart";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const COCA = id(1);
const AGUA = id(2);

const menu: Menu = {
  categories: [
    {
      id: id(100),
      name: "Bebidas",
      sizes: [],
      products: [
        { id: COCA, name: "Coca-Cola 2L", description: null, imageUrl: null, priceCents: 1500, sizePrices: [], allowsHalf: false, available: true, optionGroupIds: [] },
        { id: AGUA, name: "Água", description: null, imageUrl: null, priceCents: 400, sizePrices: [], allowsHalf: false, available: false, optionGroupIds: [] },
      ],
    },
  ],
  optionGroups: [],
};
const ctx: PricingContext = { menu, halfPriceRule: "highest", halfAndHalfEnabled: true, addonsEnabled: true };

function line(productId: string, quantity: number, unitPriceCents: number): CartLine {
  return { key: productId, label: "x", unitPriceCents, input: { kind: "simple", productId, optionIds: [], quantity, notes: null } };
}

describe("repriceCart", () => {
  it("usa o preço atual do cardápio, não o guardado", () => {
    const result = repriceCart(ctx, [line(COCA, 2, 1400)]);
    expect(result.subtotalCents).toBe(3000);
    expect(result.hasProblems).toBe(false);
    expect(result.lines[0]).toMatchObject({ totalCents: 3000, problem: null });
  });

  it("marca item esgotado ou removido e não soma no subtotal", () => {
    const result = repriceCart(ctx, [line(COCA, 1, 1400), line(AGUA, 1, 400), line(id(99), 1, 900)]);
    expect(result.subtotalCents).toBe(1500);
    expect(result.hasProblems).toBe(true);
    expect(result.lines[1]).toMatchObject({ totalCents: null, problem: "não está mais disponível" });
    expect(result.lines[2]).toMatchObject({ totalCents: null, problem: "não está mais disponível" });
  });
});
