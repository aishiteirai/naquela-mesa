import { describe, expect, it } from "vitest";
import { groupUsage } from "./group-usage";

describe("groupUsage", () => {
  it("lista os produtos de cada grupo na ordem do cardápio", () => {
    const usage = groupUsage([
      {
        products: [
          { id: "p1", name: "Mussarela", categoryId: "c1", optionGroupIds: ["g1"] },
          { id: "p2", name: "Calabresa", categoryId: "c1", optionGroupIds: ["g1", "g2"] },
        ],
      },
      { products: [{ id: "p3", name: "Coca", categoryId: "c2", optionGroupIds: [] }] },
    ]);
    expect(usage.get("g1")?.map((p) => p.name)).toEqual(["Mussarela", "Calabresa"]);
    expect(usage.get("g2")?.map((p) => p.id)).toEqual(["p2"]);
    expect(usage.get("g3")).toBeUndefined();
  });
});
