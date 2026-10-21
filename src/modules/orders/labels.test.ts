import { describe, expect, it } from "vitest";
import {
  CHANNEL_LABELS,
  FULFILLMENT_LABELS,
  formatOrderAddress,
  formatOrderNumber,
  PAYMENT_LABELS,
  paymentLabel,
  statusLabel,
} from "./labels";

describe("labels", () => {
  it.each([
    [1, "#0001"],
    [42, "#0042"],
    [12345, "#12345"],
  ])("formatOrderNumber(%d) → %s", (n, text) => {
    expect(formatOrderNumber(n)).toBe(text);
  });

  it("status em português, 'pronto' depende do tipo", () => {
    expect(statusLabel("received", "delivery")).toBe("Recebido — aguardando a loja");
    expect(statusLabel("out_for_delivery", "delivery")).toBe("Saiu para entrega");
    expect(statusLabel("ready", "pickup")).toBe("Pronto para retirada");
    expect(statusLabel("ready", "dine_in")).toBe("Pronto");
    expect(statusLabel("cancelled", "pickup")).toBe("Cancelado");
  });

  it("formas de pagamento e tipos", () => {
    expect(PAYMENT_LABELS.card_on_delivery).toBe("Cartão na entrega");
    expect(PAYMENT_LABELS.on_pickup).toBe("Pagar na retirada");
    expect(paymentLabel("on_pickup", "pickup")).toBe("Pagar na retirada");
    expect(FULFILLMENT_LABELS.dine_in).toBe("Consumo no local");
  });
});

describe("CHANNEL_LABELS", () => {
  it("nomeia os canais", () => {
    expect(CHANNEL_LABELS).toEqual({ web: "Cardápio online", whatsapp: "WhatsApp" });
  });
});

describe("formatOrderAddress", () => {
  it("monta o endereço com complemento e referência opcionais", () => {
    const base = { street: "Rua A", number: "10", complement: null, neighborhood: "Centro", city: null, zipCode: null, reference: null };
    expect(formatOrderAddress(base)).toBe("Rua A, 10 — Centro");
    expect(formatOrderAddress({ ...base, complement: "apto 3", reference: "portão azul" })).toBe(
      "Rua A, 10 - apto 3 — Centro (ref.: portão azul)",
    );
  });
});

describe("paymentLabel", () => {
  it("cartão só é 'na entrega' no delivery", () => {
    expect(paymentLabel("card_on_delivery", "delivery")).toBe("Cartão na entrega");
    expect(paymentLabel("card_on_delivery", "pickup")).toBe("Cartão (maquininha)");
    expect(paymentLabel("card_on_delivery", "dine_in")).toBe("Cartão (maquininha)");
    expect(paymentLabel("pix", "pickup")).toBe("Pix");
  });
});
