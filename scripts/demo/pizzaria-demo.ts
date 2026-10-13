import type { CatalogDefinition } from "@/modules/catalog";
import type { CreateStoreInput, StoreHourInput } from "@/modules/stores";

export const DEMO_STORE_SLUG = "pizzaria-demo";

export const demoStore: CreateStoreInput = {
  slug: DEMO_STORE_SLUG,
  name: "Pizzaria Demo",
  whatsappPhone: "+5511999999999",
  address: "Rua das Flores, 123 - Centro",
  theme: { primary: "#B91C1C", secondary: "#F59E0B" },
  rules: { minOrderCents: 3000, deliveryFee: { strategy: "fixed", fixedCents: 600 } },
  paymentMethods: { cash: true, cardOnDelivery: true, pixKey: "pix@pizzariademo.com.br" },
};

// Segunda fechado; sexta e sábado viram a meia-noite.
export const demoHours: StoreHourInput[] = [
  { weekday: 0, opensAt: "18:00", closesAt: "23:30" },
  { weekday: 2, opensAt: "18:00", closesAt: "23:30" },
  { weekday: 3, opensAt: "18:00", closesAt: "23:30" },
  { weekday: 4, opensAt: "18:00", closesAt: "23:30" },
  { weekday: 5, opensAt: "18:00", closesAt: "00:30" },
  { weekday: 6, opensAt: "18:00", closesAt: "00:30" },
];

export const demoCatalog: CatalogDefinition = {
  optionGroups: [
    {
      key: "borda",
      name: "Borda recheada",
      minSelect: 0,
      maxSelect: 1,
      options: [
        { name: "Catupiry", priceCents: 800 },
        { name: "Cheddar", priceCents: 800 },
        { name: "Chocolate", priceCents: 1000 },
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
        { name: "Margherita", description: "Mussarela, tomate e manjericão fresco.", sizePrices: { broto: 3490, media: 4790, grande: 5890 }, allowsHalf: true, optionGroupKeys: ["borda"] },
        { name: "Portuguesa", description: "Presunto, ovos, cebola, ervilha e mussarela.", sizePrices: { broto: 3790, media: 4990, grande: 6190 }, allowsHalf: true, optionGroupKeys: ["borda"] },
        { name: "Frango com Catupiry", description: "Frango desfiado com catupiry original.", sizePrices: { broto: 3790, media: 4990, grande: 6190 }, allowsHalf: true, available: false, optionGroupKeys: ["borda"] },
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
        { name: "Romeu e Julieta", description: "Goiabada com mussarela.", sizePrices: { broto: 3490, media: 4690 }, allowsHalf: true },
      ],
    },
    {
      name: "Bebidas",
      products: [
        { name: "Coca-Cola 2L", priceCents: 1400 },
        { name: "Guaraná Antarctica 2L", priceCents: 1200 },
        { name: "Água sem gás 500ml", priceCents: 400 },
      ],
    },
    {
      name: "Sobremesas",
      products: [{ name: "Petit gâteau", description: "Com sorvete de creme.", priceCents: 1890 }],
    },
  ],
};

export const DEMO_OWNER = {
  email: "dono@pizzariademo.test",
  password: "demo-senha-123",
  name: "Dono da Pizzaria Demo",
} as const;
