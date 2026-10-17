import { describe, expect, it } from "vitest";
import { PANEL_FULFILLMENT_LABELS, queueStatusLabel } from "./labels";

describe("PANEL_FULFILLMENT_LABELS", () => {
  it("tem os três rótulos curtos", () => {
    expect(PANEL_FULFILLMENT_LABELS).toEqual({ delivery: "Delivery", pickup: "Retirada", dine_in: "Na mesa" });
  });
});

describe("queueStatusLabel", () => {
  it("received vira Novo", () => {
    expect(queueStatusLabel("received", "delivery")).toBe("Novo");
  });
  it("demais status seguem statusLabel", () => {
    expect(queueStatusLabel("preparing", "pickup")).toBe("Em preparo");
    expect(queueStatusLabel("ready", "pickup")).toBe("Pronto para retirada");
    expect(queueStatusLabel("cancelled", "dine_in")).toBe("Cancelado");
  });
});
