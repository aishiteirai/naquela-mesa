import { describe, expect, it } from "vitest";
import { buildStatusMessage } from "./status-message";

const base = {
  customerName: "Maria Silva",
  number: 7,
  fulfillment: "delivery" as const,
  storeName: "Pizzaria Demo",
  trackingUrl: "https://app.test/pizzaria-demo/pedido/t",
  cancelReason: null,
};

describe("buildStatusMessage", () => {
  it.each([
    ["received", "delivery", "Olá, Maria! Recebemos seu pedido #0007 na Pizzaria Demo."],
    ["preparing", "delivery", "Olá, Maria! Seu pedido #0007 da Pizzaria Demo está em preparo."],
    ["out_for_delivery", "delivery", "Olá, Maria! Seu pedido #0007 da Pizzaria Demo saiu para entrega."],
    ["ready", "pickup", "Olá, Maria! Seu pedido #0007 da Pizzaria Demo está pronto para retirada."],
    ["ready", "dine_in", "Olá, Maria! Seu pedido #0007 da Pizzaria Demo está pronto."],
    ["completed", "delivery", "Olá, Maria! Obrigado pelo pedido #0007 na Pizzaria Demo."],
  ] as const)("%s (%s)", (status, fulfillment, first) => {
    expect(buildStatusMessage({ ...base, status, fulfillment })).toBe(`${first}\nAcompanhe: ${base.trackingUrl}`);
  });

  it("cancelado leva o motivo", () => {
    expect(buildStatusMessage({ ...base, status: "cancelled", cancelReason: "acabou a massa" })).toBe(
      `Olá, Maria! Seu pedido #0007 da Pizzaria Demo foi cancelado. Motivo: acabou a massa\nAcompanhe: ${base.trackingUrl}`,
    );
  });
});
