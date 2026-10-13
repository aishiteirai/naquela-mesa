import { describe, expect, it } from "vitest";
import { swapOrder } from "./ordering";

describe("swapOrder", () => {
  it("sobe e desce um item", () => {
    expect(swapOrder(["a", "b", "c"], "b", "up")).toEqual(["b", "a", "c"]);
    expect(swapOrder(["a", "b", "c"], "b", "down")).toEqual(["a", "c", "b"]);
  });

  it("null nas pontas ou id ausente", () => {
    expect(swapOrder(["a", "b"], "a", "up")).toBeNull();
    expect(swapOrder(["a", "b"], "b", "down")).toBeNull();
    expect(swapOrder(["a", "b"], "x", "up")).toBeNull();
  });
});
