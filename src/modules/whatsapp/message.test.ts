import { describe, expect, it } from "vitest";
import type { PlacedOrder } from "@/modules/orders";
import { buildContactMessage, buildOrderMessage, waMeLink } from "./message";

const NBSP = "\u00a0";
const brl = (text: string) => text.replaceAll("R$ ", `R$${NBSP}`);

const order: PlacedOrder = {
  orderId: "o1",
  number: 7,
  publicToken: "t",
  fulfillment: "delivery",
  customerName: "Maria Silva",
  customerPhone: "+5511988887777",
  address: { street: "Rua das Acácias", number: "45", complement: "ap 3", neighborhood: "Centro", city: null, zipCode: null, reference: "portão azul" },
  tableLabel: null,
  paymentMethod: "cash",
  changeForCents: 10000,
  notes: "tocar a campainha",
  lines: [
    {
      productName: "Calabresa / Mussarela",
      sizeName: "Grande",
      flavors: ["Calabresa", "Mussarela"],
      options: [{ groupName: "Borda recheada", optionName: "Catupiry", priceCents: 800 }],
      quantity: 1,
      unitPriceCents: 6490,
      totalCents: 6490,
      notes: "sem cebola",
    },
    { productName: "Coca-Cola 2L", sizeName: null, flavors: [], options: [], quantity: 2, unitPriceCents: 1400, totalCents: 2800, notes: null },
  ],
  subtotalCents: 9290,
  deliveryFeeCents: 600,
  totalCents: 9890,
  store: { slug: "pizzaria-demo", name: "Pizzaria Demo", whatsappPhone: "+5511999999999" },
};

describe("buildOrderMessage", () => {
  it("monta a mensagem completa do pedido", () => {
    expect(buildOrderMessage(order, "https://app.test/pizzaria-demo/pedido/t")).toBe(
      brl(
        [
          "*Pedido #0007* — Pizzaria Demo",
          "Delivery",
          "Cliente: Maria Silva (+5511988887777)",
          "",
          "1x Grande — ½ Calabresa + ½ Mussarela — R$ 64,90",
          "   + Borda recheada: Catupiry",
          "   Obs.: sem cebola",
          "2x Coca-Cola 2L — R$ 28,00",
          "",
          "Subtotal: R$ 92,90",
          "Entrega: R$ 6,00",
          "*Total: R$ 98,90*",
          "Pagamento: Dinheiro (troco para R$ 100,00)",
          "",
          "Endereço: Rua das Acácias, 45 - ap 3 — Centro",
          "Referência: portão azul",
          "Obs. do pedido: tocar a campainha",
          "",
          "Acompanhe: https://app.test/pizzaria-demo/pedido/t",
        ].join("\n"),
      ),
    );
  });

  it("retirada sem endereço nem taxa; mesa aparece no consumo no local", () => {
    const pickup = buildOrderMessage({ ...order, fulfillment: "pickup", address: null, deliveryFeeCents: 0, notes: null }, "u");
    expect(pickup).not.toContain("Entrega:");
    expect(pickup).not.toContain("Endereço:");
    expect(pickup).toContain("Retirada no balcão");

    const dineIn = buildOrderMessage({ ...order, fulfillment: "dine_in", address: null, tableLabel: "12", deliveryFeeCents: 0 }, "u");
    expect(dineIn).toContain("Mesa: 12");
  });

  it("cartão na retirada e na mesa é 'maquininha', no delivery é 'na entrega'", () => {
    const card = { ...order, paymentMethod: "card_on_delivery" as const };
    expect(buildOrderMessage({ ...card, fulfillment: "pickup", address: null, deliveryFeeCents: 0 }, "u")).toContain("Pagamento: Cartão (maquininha)");
    expect(buildOrderMessage({ ...card, fulfillment: "delivery" }, "u")).toContain("Pagamento: Cartão na entrega");
  });
});

describe("waMeLink e contato", () => {
  it("usa só dígitos do telefone e codifica o texto", () => {
    expect(waMeLink("+55 11 99999-9999", "Olá & tchau\n#1")).toBe("https://wa.me/5511999999999?text=Ol%C3%A1%20%26%20tchau%0A%231");
  });

  it("mensagem curta de contato", () => {
    expect(buildContactMessage(7, "https://app.test/x")).toBe("Olá! Sobre o meu pedido #0007: https://app.test/x");
  });
});
