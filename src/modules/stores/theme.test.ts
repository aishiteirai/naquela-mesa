import { describe, expect, it } from "vitest";
import { readableTextColor, themeCssVariables } from "./theme";

describe("readableTextColor", () => {
  it.each([
    ["#FFFFFF", "#000000"],
    ["#000000", "#FFFFFF"],
    ["#B91C1C", "#FFFFFF"],
    ["#F59E0B", "#000000"],
    ["#ffff00", "#000000"],
    ["#1d4ed8", "#FFFFFF"],
  ])("%s → %s", (background, expected) => {
    expect(readableTextColor(background)).toBe(expected);
  });

  it("recusa cor fora do formato #RRGGBB", () => {
    expect(() => readableTextColor("red")).toThrow(RangeError);
  });
});

describe("themeCssVariables", () => {
  it("gera variáveis da marca e sobrescreve os tokens do shadcn", () => {
    expect(themeCssVariables({ primary: "#B91C1C", secondary: "#F59E0B", font: "sans" })).toEqual({
      "--brand-secondary": "#F59E0B",
      "--brand-secondary-foreground": "#000000",
      "--primary": "#B91C1C",
      "--primary-foreground": "#FFFFFF",
      "--ring": "#B91C1C",
      "--heading-font": "var(--font-geist-sans)",
    });
  });

  it("usa Lora nos títulos quando a fonte é serif", () => {
    expect(themeCssVariables({ primary: "#B91C1C", secondary: "#F59E0B", font: "serif" })["--heading-font"]).toBe(
      "var(--font-lora)",
    );
  });

  it("primária clara ganha texto preto nos botões", () => {
    const vars = themeCssVariables({ primary: "#ffff00", secondary: "#F59E0B", font: "sans" });
    expect(vars["--primary-foreground"]).toBe("#000000");
    expect(vars["--ring"]).toBe("#000000");
  });
});
