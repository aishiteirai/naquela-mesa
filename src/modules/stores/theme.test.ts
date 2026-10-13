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
  it("gera variáveis da marca com texto legível", () => {
    expect(themeCssVariables({ primary: "#B91C1C", secondary: "#F59E0B", font: "sans" })).toEqual({
      "--brand-primary": "#B91C1C",
      "--brand-primary-foreground": "#FFFFFF",
      "--brand-secondary": "#F59E0B",
      "--brand-secondary-foreground": "#000000",
    });
  });
});
