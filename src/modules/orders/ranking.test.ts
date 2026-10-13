import { describe, expect, it } from "vitest";
import { formatQuantity, rankProducts } from "./ranking";

const simple = (name: string, quantity: number, totalCents: number) => ({ productName: name, sizeName: null, flavors: [], quantity, totalCents });
const pizza = (flavors: string[], quantity: number, totalCents: number) => ({
  productName: flavors.join(" / "),
  sizeName: "Grande",
  flavors,
  quantity,
  totalCents,
});

describe("rankProducts", () => {
  it("conta item simples pelo nome e pizza por sabor, meio a meio vale metade", () => {
    expect(
      rankProducts([
        simple("Coca-Cola 2L", 2, 2800),
        pizza(["Calabresa"], 1, 5690),
        pizza(["Calabresa", "Mussarela"], 1, 5690),
      ]),
    ).toEqual([
      { name: "Coca-Cola 2L", quantity: 2, revenueCents: 2800 },
      { name: "Calabresa", quantity: 1.5, revenueCents: 8535 },
      { name: "Mussarela", quantity: 0.5, revenueCents: 2845 },
    ]);
  });

  it("soma tamanhos diferentes do mesmo sabor", () => {
    const ranked = rankProducts([
      { productName: "Calabresa", sizeName: "Broto", flavors: ["Calabresa"], quantity: 1, totalCents: 3490 },
      { productName: "Calabresa", sizeName: "Grande", flavors: ["Calabresa"], quantity: 1, totalCents: 5690 },
    ]);
    expect(ranked).toEqual([{ name: "Calabresa", quantity: 2, revenueCents: 9180 }]);
  });

  it("desempata por faturamento e depois por nome, e respeita o limite", () => {
    const ranked = rankProducts([simple("Suco", 1, 800), simple("Água", 1, 500), simple("Brownie", 1, 800), simple("Pudim", 3, 900)], 3);
    expect(ranked.map((product) => product.name)).toEqual(["Pudim", "Brownie", "Suco"]);
  });

  it("padrão é top 10", () => {
    const lines = Array.from({ length: 12 }, (_, index) => simple(`Produto ${String(index).padStart(2, "0")}`, 1, 100));
    expect(rankProducts(lines)).toHaveLength(10);
  });
});

describe("formatQuantity", () => {
  it("mostra inteiro sem casas e fração com vírgula", () => {
    expect(formatQuantity(2)).toBe("2");
    expect(formatQuantity(1.5)).toBe("1,5");
    expect(formatQuantity(1234)).toBe("1.234");
  });
});
