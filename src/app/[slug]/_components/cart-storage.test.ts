import { describe, expect, it } from "vitest";
import { parseStoredCart } from "./cart-storage";

const valid = {
  key: "k1",
  label: "1x Coca",
  unitPriceCents: 600,
  input: { kind: "simple", productId: "p1", optionIds: [], quantity: 2, notes: null },
};
const validSized = {
  key: "k2",
  label: "1x Pizza",
  unitPriceCents: 4000,
  input: { kind: "sized", sizeId: "s1", flavorIds: ["a", "b"], optionIds: ["o"], quantity: 1, notes: "sem cebola" },
};

describe("parseStoredCart", () => {
  it("mantém linhas válidas", () => {
    expect(parseStoredCart(JSON.stringify([valid, validSized]))).toEqual([valid, validSized]);
  });

  it("descarta linhas inválidas e mantém as válidas", () => {
    const bad = [
      {},
      null,
      { input: null },
      { ...valid, input: { ...valid.input, kind: "other" } },
      { ...valid, input: { ...valid.input, quantity: 0 } },
      { ...valid, input: { ...valid.input, quantity: 1000 } },
      { ...valid, unitPriceCents: -1 },
      { ...valid, key: 1 },
    ];
    expect(parseStoredCart(JSON.stringify([...bad, valid]))).toEqual([valid]);
  });

  it("retorna [] para entrada inválida", () => {
    expect(parseStoredCart(null)).toEqual([]);
    expect(parseStoredCart("não é json")).toEqual([]);
    expect(parseStoredCart('{"input":null}')).toEqual([]);
    expect(parseStoredCart("[]")).toEqual([]);
  });
});
