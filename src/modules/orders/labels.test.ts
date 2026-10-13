import { describe, expect, it } from "vitest";
import { FULFILLMENT_LABELS, formatOrderNumber, PAYMENT_LABELS, statusLabel } from "./labels";

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
    expect(FULFILLMENT_LABELS.dine_in).toBe("Consumo no local");
  });
});
