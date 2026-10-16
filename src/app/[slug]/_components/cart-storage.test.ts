import { describe, expect, it } from "vitest";
import { addCartLine, parseStoredCart, type CartLine } from "./cart-storage";

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

describe("addCartLine", () => {
  const coca = valid as CartLine;
  const pizza = validSized as CartLine;

  it("item novo vira uma linha nova", () => {
    expect(addCartLine([coca], pizza)).toEqual([coca, pizza]);
  });

  it("item igual soma a quantidade na linha existente", () => {
    const again = { ...coca, key: "k9", input: { ...coca.input, quantity: 3 } };
    expect(addCartLine([coca, pizza], again)).toEqual([{ ...coca, input: { ...coca.input, quantity: 5 } }, pizza]);
  });

  it("observação ou adicionais diferentes são outro item", () => {
    const withNotes = { ...coca, key: "k9", input: { ...coca.input, notes: "gelada" } };
    expect(addCartLine([coca], withNotes)).toHaveLength(2);
    const otherOptions = { ...pizza, key: "k9", input: { ...pizza.input, optionIds: [] } };
    expect(addCartLine([pizza], otherOptions)).toHaveLength(2);
  });

  it("não passa do máximo por item", () => {
    const many = { ...coca, key: "k9", input: { ...coca.input, quantity: 99 } };
    expect(addCartLine([coca], many)[0]?.input.quantity).toBeLessThanOrEqual(99);
  });
});
