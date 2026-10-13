import { describe, expect, it } from "vitest";
import { assertCents, formatBRL } from "./money";

// Intl usa espaço não separável (U+00A0) entre "R$" e o número.
const NBSP = "\u00A0";

describe("formatBRL", () => {
  it("formata centavos em reais", () => {
    expect(formatBRL(1250)).toBe(`R$${NBSP}12,50`);
  });

  it("formata zero", () => {
    expect(formatBRL(0)).toBe(`R$${NBSP}0,00`);
  });

  it("usa separador de milhar", () => {
    expect(formatBRL(123456)).toBe(`R$${NBSP}1.234,56`);
  });
});

describe("assertCents", () => {
  it("aceita inteiro não negativo", () => {
    expect(() => assertCents(0)).not.toThrow();
    expect(() => assertCents(999)).not.toThrow();
  });

  it.each([12.5, -1, Number.NaN, Number.POSITIVE_INFINITY])("rejeita %s", (value) => {
    expect(() => assertCents(value)).toThrow(RangeError);
  });

  it("formatBRL rejeita valor fracionado", () => {
    expect(() => formatBRL(12.5)).toThrow(RangeError);
  });
});
