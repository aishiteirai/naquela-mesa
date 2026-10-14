import { describe, expect, it } from "vitest";
import { DomainError } from "@/shared/errors";
import { toCheckoutError } from "./messages";

const NBSP = " ";

describe("toCheckoutError", () => {
  it.each([
    [new DomainError("STORE_CLOSED", { message: "Abre hoje às 18:00" }), "A loja está fechada agora. Abre hoje às 18:00"],
    [new DomainError("ITEM_UNAVAILABLE", { itemIndex: 0, name: "Calabresa" }), "Calabresa não está disponível. Remova da sacola e tente de novo."],
    [new DomainError("INVALID_OPTIONS", { itemIndex: 1, reason: "escolha ao menos 1 em Molho" }), "Revise o item 2 da sacola: escolha ao menos 1 em Molho."],
    [new DomainError("BELOW_MIN_ORDER", { minOrderCents: 3000 }), `Pedido mínimo de R$${NBSP}30,00 (sem a entrega).`],
    [new DomainError("ZONE_NOT_SERVED"), "Ainda não entregamos nesse bairro. Que tal retirar no balcão?"],
    [new DomainError("FULFILLMENT_DISABLED"), "Esse tipo de pedido não está disponível agora. Escolha outra opção."],
    [new DomainError("PAYMENT_DISABLED"), "Essa forma de pagamento não está disponível. Escolha outra."],
    [new DomainError("NOT_FOUND"), "Loja não encontrada."],
    [new DomainError("INVALID_TRANSITION"), "Não foi possível enviar o pedido. Tente de novo."],
  ])("%o", (error, message) => {
    expect(toCheckoutError(error)).toMatchObject({ code: error.code, message, fieldErrors: {} });
  });

  it("PRICE_CHANGED leva o novo orçamento", () => {
    const quote = { lines: [], subtotalCents: 100, deliveryFeeCents: 0, totalCents: 100 };
    expect(toCheckoutError(new DomainError("PRICE_CHANGED", { quote }))).toEqual({
      code: "PRICE_CHANGED",
      message: "Os preços mudaram desde a revisão. Confira o novo total e confirme de novo.",
      fieldErrors: {},
      quote,
    });
  });

  it("VALIDATION vira erros por campo", () => {
    const error = new DomainError("VALIDATION", { issues: [{ path: "customer.phone", message: "telefone inválido" }] });
    expect(toCheckoutError(error)).toEqual({
      code: "VALIDATION",
      message: "Confira os campos destacados.",
      fieldErrors: { "customer.phone": "telefone inválido" },
    });
  });

  it("traduz RATE_LIMITED", () => {
    expect(toCheckoutError(new DomainError("RATE_LIMITED", { retryAfterSec: 120 }))).toEqual({
      code: "RATE_LIMITED",
      message: "Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente de novo.",
      fieldErrors: {},
    });
  });
});
