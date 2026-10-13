import { describe, expect, it } from "vitest";
import { startingPriceCents } from "./menu";

describe("startingPriceCents", () => {
  it("usa o menor preço entre os tamanhos", () => {
    expect(
      startingPriceCents({
        priceCents: null,
        sizePrices: [
          { sizeId: "g", priceCents: 5690 },
          { sizeId: "b", priceCents: 3490 },
          { sizeId: "m", priceCents: 4690 },
        ],
      }),
    ).toBe(3490);
  });

  it("usa priceCents quando não há tamanhos", () => {
    expect(startingPriceCents({ priceCents: 1400, sizePrices: [] })).toBe(1400);
  });

  it("null quando não há preço", () => {
    expect(startingPriceCents({ priceCents: null, sizePrices: [] })).toBeNull();
  });
});
