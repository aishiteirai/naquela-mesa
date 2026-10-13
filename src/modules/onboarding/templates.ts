import type { CatalogDefinition } from "@/modules/catalog";

export const STORE_TEMPLATES = ["pizzaria", "hamburgueria", "lanchonete"] as const;
export type StoreTemplate = (typeof STORE_TEMPLATES)[number];

export const TEMPLATE_LABELS: Record<StoreTemplate, string> = {
  pizzaria: "Pizzaria",
  hamburgueria: "Hamburgueria",
  lanchonete: "Lanchonete",
};

/** Recursos ligados por modelo (o resto fica no padrão da loja). */
export const TEMPLATE_FEATURES: Record<StoreTemplate, { halfAndHalf: boolean }> = {
  pizzaria: { halfAndHalf: true },
  hamburgueria: { halfAndHalf: false },
  lanchonete: { halfAndHalf: false },
};

const bebidas = {
  name: "Bebidas",
  products: [
    { name: "Refrigerante 2L", priceCents: 1400 },
    { name: "Refrigerante lata", priceCents: 600 },
    { name: "Água sem gás 500ml", priceCents: 400 },
  ],
};

const CATALOGS: Record<StoreTemplate, CatalogDefinition> = {
  pizzaria: {
    optionGroups: [
      {
        key: "borda",
        name: "Borda recheada",
        minSelect: 0,
        maxSelect: 1,
        options: [
          { name: "Catupiry", priceCents: 800 },
          { name: "Cheddar", priceCents: 800 },
        ],
      },
    ],
    categories: [
      {
        name: "Pizzas Salgadas",
        sizes: [
          { key: "broto", name: "Broto", maxFlavors: 1 },
          { key: "media", name: "Média", maxFlavors: 2 },
          { key: "grande", name: "Grande", maxFlavors: 2 },
        ],
        products: [
          { name: "Mussarela", description: "Molho de tomate, mussarela e orégano.", sizePrices: { broto: 3290, media: 4490, grande: 5490 }, allowsHalf: true, optionGroupKeys: ["borda"] },
          { name: "Calabresa", description: "Calabresa fatiada, cebola e azeitonas.", sizePrices: { broto: 3490, media: 4690, grande: 5690 }, allowsHalf: true, optionGroupKeys: ["borda"] },
          { name: "Portuguesa", description: "Presunto, ovos, cebola, ervilha e mussarela.", sizePrices: { broto: 3790, media: 4990, grande: 6190 }, allowsHalf: true, optionGroupKeys: ["borda"] },
          { name: "Frango com Catupiry", description: "Frango desfiado com catupiry.", sizePrices: { broto: 3790, media: 4990, grande: 6190 }, allowsHalf: true, optionGroupKeys: ["borda"] },
        ],
      },
      {
        name: "Pizzas Doces",
        sizes: [
          { key: "broto", name: "Broto", maxFlavors: 1 },
          { key: "media", name: "Média", maxFlavors: 2 },
        ],
        products: [
          { name: "Chocolate", description: "Chocolate ao leite com granulado.", sizePrices: { broto: 3490, media: 4690 }, allowsHalf: true },
          { name: "Banana com Canela", description: "Banana, açúcar e canela.", sizePrices: { broto: 3290, media: 4490 }, allowsHalf: true },
        ],
      },
      bebidas,
    ],
  },
  hamburgueria: {
    optionGroups: [
      {
        key: "adicionais",
        name: "Adicionais",
        minSelect: 0,
        maxSelect: 4,
        options: [
          { name: "Bacon", priceCents: 500 },
          { name: "Cheddar extra", priceCents: 400 },
          { name: "Ovo", priceCents: 300 },
          { name: "Hambúrguer extra", priceCents: 900 },
        ],
      },
    ],
    categories: [
      {
        name: "Hambúrgueres",
        products: [
          { name: "X-Burguer", description: "Pão, hambúrguer 150 g e queijo.", priceCents: 2490, optionGroupKeys: ["adicionais"] },
          { name: "X-Salada", description: "Hambúrguer 150 g, queijo, alface e tomate.", priceCents: 2690, optionGroupKeys: ["adicionais"] },
          { name: "X-Bacon", description: "Hambúrguer 150 g, queijo e bacon.", priceCents: 2990, optionGroupKeys: ["adicionais"] },
          { name: "Smash Duplo", description: "Dois smash de 90 g com cheddar.", priceCents: 3290, optionGroupKeys: ["adicionais"] },
        ],
      },
      {
        name: "Porções",
        products: [
          { name: "Batata frita", description: "Porção de 300 g.", priceCents: 1890 },
          { name: "Onion rings", description: "Porção de 250 g.", priceCents: 2190 },
        ],
      },
      bebidas,
    ],
  },
  lanchonete: {
    optionGroups: [
      {
        key: "extras",
        name: "Extras",
        minSelect: 0,
        maxSelect: 3,
        options: [
          { name: "Queijo extra", priceCents: 300 },
          { name: "Presunto extra", priceCents: 300 },
          { name: "Ovo", priceCents: 300 },
        ],
      },
    ],
    categories: [
      {
        name: "Lanches",
        products: [
          { name: "Misto quente", description: "Pão de forma, presunto e queijo.", priceCents: 1200, optionGroupKeys: ["extras"] },
          { name: "Bauru", description: "Pão francês, rosbife, queijo e tomate.", priceCents: 1590, optionGroupKeys: ["extras"] },
          { name: "Americano", description: "Presunto, queijo, ovo, alface e tomate.", priceCents: 1690, optionGroupKeys: ["extras"] },
        ],
      },
      {
        name: "Salgados",
        products: [
          { name: "Coxinha", priceCents: 700 },
          { name: "Pastel de carne", priceCents: 900 },
          { name: "Esfiha de carne", priceCents: 600 },
        ],
      },
      {
        name: "Bebidas",
        products: [
          { name: "Café", priceCents: 500 },
          { name: "Suco natural 400ml", priceCents: 900 },
          { name: "Refrigerante lata", priceCents: 600 },
        ],
      },
    ],
  },
};

export function templateCatalog(template: StoreTemplate): CatalogDefinition {
  return CATALOGS[template];
}
