import { describe, expect, it } from "vitest";
import { storeInfo } from "./store-info";

const NBSP = "\u00a0";

function input(overrides: Partial<Parameters<typeof storeInfo>[0]> = {}): Parameters<typeof storeInfo>[0] {
  return {
    features: { delivery: true, pickup: true, dineIn: false, halfAndHalf: true, addons: true, coupons: false, scheduling: false },
    rules: {
      minOrderCents: 3000,
      prepTimeMin: 30,
      deliveryTimeMin: 45,
      halfPriceRule: "highest",
      autoPrintOnAccept: false,
      deliveryFee: { strategy: "fixed", fixedCents: 600 },
    },
    zones: [],
    ...overrides,
  };
}

describe("storeInfo", () => {
  it("delivery com taxa fixa, retirada e mínimo", () => {
    expect(storeInfo(input())).toEqual([
      "Entrega ~45 min",
      `Taxa R$${NBSP}6,00`,
      "Retirada ~30 min",
      `Pedido mínimo R$${NBSP}30,00`,
    ]);
  });

  it("taxa fixa zero vira entrega grátis; sem mínimo não mostra o mínimo", () => {
    const base = input();
    expect(storeInfo({ ...base, rules: { ...base.rules, minOrderCents: 0, deliveryFee: { strategy: "fixed", fixedCents: 0 } } })).toEqual([
      "Entrega ~45 min",
      "Entrega grátis",
      "Retirada ~30 min",
    ]);
  });

  it("taxa por bairro mostra a menor taxa", () => {
    const base = input();
    const rules = { ...base.rules, deliveryFee: { strategy: "by_neighborhood" as const } };
    expect(storeInfo({ ...base, rules, zones: [{ feeCents: 800 }, { feeCents: 500 }] })[1]).toBe(`Taxa a partir de R$${NBSP}5,00`);
    expect(storeInfo({ ...base, rules, zones: [] })[1]).toBe("Taxa por bairro");
  });

  it("só retirada não fala de entrega", () => {
    const base = input();
    expect(storeInfo({ ...base, features: { ...base.features, delivery: false } })).toEqual(["Retirada ~30 min", `Pedido mínimo R$${NBSP}30,00`]);
  });
});
