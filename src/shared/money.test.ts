import { describe, expect, it } from "vitest";
import { assertCents, formatBRL, formatCentsForInput, parseBRLToCents } from "./money";

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

describe("parseBRLToCents", () => {
  it.each([
    ["34,90", 3490],
    ["34,9", 3490],
    ["34", 3400],
    ["0", 0],
    ["1.234,56", 123456],
    ["R$ 12", 1200],
    ["R$12,50", 1250],
    ["  7,05 ", 705],
  ])("%s → %d", (input, cents) => {
    expect(parseBRLToCents(input)).toBe(cents);
  });

  it.each(["", "abc", "-1", "12.50", "12,505", "1.23,00", "12,", ",50", "1 000"])("recusa %s", (input) => {
    expect(parseBRLToCents(input)).toBeNull();
  });
});

describe("formatCentsForInput", () => {
  it.each([
    [3490, "34,90"],
    [705, "7,05"],
    [0, "0,00"],
    [123456, "1234,56"],
  ])("%d → %s", (cents, text) => {
    expect(formatCentsForInput(cents)).toBe(text);
  });
});

it("formatBRL(-0) não mostra sinal", () => {
  expect(formatBRL(-0)).toBe(`R$${NBSP}0,00`);
});
