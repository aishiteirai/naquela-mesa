import { describe, expect, it } from "vitest";
import { readableTextColor } from "@/modules/stores/client";
import { panelThemeVariables } from "./panel-theme";

const base = { primary: "#B91C1C", secondary: "#F59E0B", font: "sans" as const };

describe("panelThemeVariables", () => {
  it("naquela não injeta variáveis", () => {
    expect(panelThemeVariables({ ...base, panelColors: "naquela" })).toEqual({});
  });

  it("store injeta primária, secundária e texto legível", () => {
    const vars = panelThemeVariables({ ...base, panelColors: "store" });
    expect(vars["--primary"]).toBe("#B91C1C");
    expect(vars["--sidebar-primary"]).toBe("#B91C1C");
    expect(vars["--ring"]).toBe("#B91C1C");
    expect(vars["--chart-1"]).toBe("#B91C1C");
    expect(vars["--chart-2"]).toBe("#F59E0B");
    expect(vars["--primary-foreground"]).toBe(readableTextColor("#B91C1C"));
    expect(vars["--sidebar-primary-foreground"]).toBe(readableTextColor("#B91C1C"));
    expect(vars["--tint"]).toMatch(/^color-mix\(/);
    expect(vars["--primary-hover"]).toMatch(/^color-mix\(/);
  });

  it("primária clara recebe texto escuro", () => {
    const vars = panelThemeVariables({ ...base, primary: "#FACC15", panelColors: "store" });
    expect(vars["--primary-foreground"]).toBe("#000000");
  });
});
