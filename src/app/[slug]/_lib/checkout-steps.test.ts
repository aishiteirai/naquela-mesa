import { describe, expect, it } from "vitest";
import { deliveryStepErrors, firstErrorStep, parseStepParam, stepForField } from "./checkout-steps";

describe("parseStepParam", () => {
  it.each([
    [null, 1],
    ["0", 1],
    ["1", 1],
    ["2", 2],
    ["4", 4],
    ["5", 1],
    ["abc", 1],
    ["2.5", 1],
  ])("%s → %s", (value, expected) => {
    expect(parseStepParam(value)).toBe(expected);
  });
});

describe("stepForField", () => {
  it.each([
    ["items", 1],
    ["items.0.optionIds", 1],
    ["fulfillment", 2],
    ["address", 2],
    ["address.street", 2],
    ["tableLabel", 2],
    ["customer.name", 3],
    ["customer.phone", 3],
    ["payment.changeForCents", 4],
    ["notes", 4],
    ["algo-desconhecido", 4],
  ])("%s → etapa %s", (path, expected) => {
    expect(stepForField(path)).toBe(expected);
  });
});

describe("firstErrorStep", () => {
  it("sem erros de campo devolve null", () => {
    expect(firstErrorStep({})).toBeNull();
  });

  it("devolve a menor etapa entre os campos com erro", () => {
    expect(firstErrorStep({ "payment.changeForCents": "x", "address.number": "y", "customer.name": "z" })).toBe(2);
  });
});

describe("deliveryStepErrors", () => {
  it("exige bairro em delivery com taxa por bairro", () => {
    expect(deliveryStepErrors({ fulfillment: "delivery", strategy: "by_neighborhood", neighborhood: "" })).toEqual({ "address.neighborhood": "escolha o bairro" });
    expect(deliveryStepErrors({ fulfillment: "delivery", strategy: "by_neighborhood", neighborhood: "  " })).toEqual({ "address.neighborhood": "escolha o bairro" });
  });

  it("não exige quando o bairro foi escolhido, taxa é fixa ou não é delivery", () => {
    expect(deliveryStepErrors({ fulfillment: "delivery", strategy: "by_neighborhood", neighborhood: "Centro" })).toEqual({});
    expect(deliveryStepErrors({ fulfillment: "delivery", strategy: "fixed", neighborhood: "" })).toEqual({});
    expect(deliveryStepErrors({ fulfillment: "pickup", strategy: "by_neighborhood", neighborhood: "" })).toEqual({});
  });
});
