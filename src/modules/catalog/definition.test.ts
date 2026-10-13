import { describe, expect, it } from "vitest";
import { catalogDefinitionSchema, type CatalogDefinition } from "./definition";

const valid: CatalogDefinition = {
  optionGroups: [{ key: "borda", name: "Borda", minSelect: 0, maxSelect: 1, options: [{ name: "Catupiry", priceCents: 800 }] }],
  categories: [
    {
      name: "Pizzas",
      sizes: [
        { key: "broto", name: "Broto", maxFlavors: 1 },
        { key: "grande", name: "Grande", maxFlavors: 2 },
      ],
      products: [{ name: "Calabresa", sizePrices: { broto: 3490, grande: 5690 }, allowsHalf: true, optionGroupKeys: ["borda"] }],
    },
    { name: "Bebidas", products: [{ name: "Coca-Cola 2L", priceCents: 1400 }] },
  ],
};

function messages(definition: unknown): string[] {
  const result = catalogDefinitionSchema.safeParse(definition);
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
}

describe("catalogDefinitionSchema", () => {
  it("aceita definição válida e aplica defaults", () => {
    const parsed = catalogDefinitionSchema.parse(valid);
    expect(parsed.categories[1]?.sizes).toEqual([]);
    expect(parsed.categories[1]?.products[0]).toMatchObject({ allowsHalf: false, available: true, optionGroupKeys: [] });
    expect(parsed.optionGroups[0]?.options[0]?.available).toBe(true);
  });

  it("recusa imagem que não é https", () => {
    const definition = structuredClone(valid);
    definition.categories[1]!.products[0]!.imageUrl = "http://x.com/a.png";
    expect(catalogDefinitionSchema.safeParse(definition).success).toBe(false);
  });

  it("exige preço para cada tamanho da categoria", () => {
    const definition = structuredClone(valid);
    definition.categories[0]!.products[0]!.sizePrices = { broto: 3490 };
    expect(messages(definition)).toContain("produto de categoria com tamanhos precisa de preço para cada tamanho (e só para eles)");
  });

  it("recusa priceCents em categoria com tamanhos", () => {
    const definition = structuredClone(valid);
    definition.categories[0]!.products[0]!.priceCents = 1000;
    expect(messages(definition)).toContain("produto de categoria com tamanhos precisa de preço para cada tamanho (e só para eles)");
  });

  it("exige priceCents em categoria sem tamanhos", () => {
    const definition = structuredClone(valid);
    delete definition.categories[1]!.products[0]!.priceCents;
    expect(messages(definition)).toContain("produto sem tamanhos precisa de priceCents");
  });

  it("meio a meio exige tamanho com 2 sabores", () => {
    const definition = structuredClone(valid);
    definition.categories[1]!.products[0]!.allowsHalf = true;
    expect(messages(definition)).toContain("meio a meio exige um tamanho com até 2 sabores");
  });

  it("recusa grupo de adicionais desconhecido", () => {
    const definition = structuredClone(valid);
    definition.categories[0]!.products[0]!.optionGroupKeys = ["molho"];
    expect(messages(definition)).toContain("grupo de adicionais desconhecido: molho");
  });

  it("recusa minSelect maior que maxSelect e preço negativo", () => {
    const definition = structuredClone(valid);
    definition.optionGroups![0]!.minSelect = 2;
    definition.optionGroups![0]!.options[0]!.priceCents = -1;
    const result = messages(definition);
    expect(result).toContain("minSelect não pode ser maior que maxSelect");
    expect(result.length).toBeGreaterThanOrEqual(2);
  });
});
