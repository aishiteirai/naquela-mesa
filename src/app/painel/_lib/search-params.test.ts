import { describe, expect, it } from "vitest";
import { firstParam } from "./search-params";

describe("firstParam", () => {
  it("devolve o primeiro valor ou null", () => {
    expect(firstParam("7d")).toBe("7d");
    expect(firstParam(["30d", "hoje"])).toBe("30d");
    expect(firstParam([])).toBeNull();
    expect(firstParam(undefined)).toBeNull();
  });
});
