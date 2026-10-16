import { describe, expect, it } from "vitest";
import { parseSettingsTab } from "./settings-tab";

describe("parseSettingsTab", () => {
  it.each([
    [null, "aparencia"],
    ["aparencia", "aparencia"],
    ["horarios", "horarios"],
    ["pedidos", "pedidos"],
    ["outra", "aparencia"],
    ["", "aparencia"],
  ])("%s → %s", (value, expected) => {
    expect(parseSettingsTab(value)).toBe(expected);
  });
});
