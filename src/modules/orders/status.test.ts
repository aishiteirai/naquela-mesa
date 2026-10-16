import { describe, expect, it } from "vitest";
import { advanceLabel, canTransition, isFinalStatus, nextStatus, timelineFor } from "./status";

describe("máquina de status", () => {
  it.each([
    ["delivery", "received", "preparing"],
    ["delivery", "preparing", "out_for_delivery"],
    ["delivery", "out_for_delivery", "completed"],
    ["pickup", "preparing", "ready"],
    ["pickup", "ready", "completed"],
    ["dine_in", "preparing", "ready"],
  ] as const)("%s: %s → %s", (fulfillment, from, to) => {
    expect(nextStatus(fulfillment, from)).toBe(to);
    expect(canTransition(fulfillment, from, to)).toBe(true);
  });

  it.each([
    ["delivery", "received", "completed"],
    ["delivery", "preparing", "ready"],
    ["pickup", "preparing", "out_for_delivery"],
    ["pickup", "received", "ready"],
    ["delivery", "completed", "cancelled"],
    ["pickup", "cancelled", "preparing"],
    ["delivery", "preparing", "received"],
  ] as const)("%s: recusa %s → %s", (fulfillment, from, to) => {
    expect(canTransition(fulfillment, from, to)).toBe(false);
  });

  it("cancelar vale a partir de qualquer status não final", () => {
    for (const status of ["received", "preparing", "out_for_delivery"] as const) {
      expect(canTransition("delivery", status, "cancelled")).toBe(true);
    }
    expect(canTransition("pickup", "ready", "cancelled")).toBe(true);
  });

  it("finais não têm próximo passo", () => {
    expect(nextStatus("delivery", "completed")).toBeNull();
    expect(nextStatus("pickup", "cancelled")).toBeNull();
    expect(isFinalStatus("completed")).toBe(true);
    expect(isFinalStatus("ready")).toBe(false);
  });

  it.each([
    ["delivery", "received", "Aceitar"],
    ["delivery", "preparing", "Saiu para entrega"],
    ["pickup", "preparing", "Pronto"],
    ["dine_in", "preparing", "Pronto"],
    ["delivery", "out_for_delivery", "Concluir"],
    ["pickup", "ready", "Concluir"],
    ["delivery", "completed", null],
  ] as const)("advanceLabel(%s, %s) → %s", (fulfillment, status, label) => {
    expect(advanceLabel(fulfillment, status)).toBe(label);
  });
});

describe("timelineFor", () => {
  it("delivery em preparo: recebido feito, preparo atual, resto adiante", () => {
    expect(timelineFor("delivery", "preparing")).toEqual([
      { status: "received", state: "done" },
      { status: "preparing", state: "current" },
      { status: "out_for_delivery", state: "upcoming" },
      { status: "completed", state: "upcoming" },
    ]);
  });

  it("retirada pronta", () => {
    expect(timelineFor("pickup", "ready")?.map((step) => step.state)).toEqual(["done", "done", "current", "upcoming"]);
  });

  it("concluído marca tudo como feito", () => {
    expect(timelineFor("dine_in", "completed")?.every((step) => step.state === "done")).toBe(true);
  });

  it("cancelado não tem linha do tempo", () => {
    expect(timelineFor("delivery", "cancelled")).toBeNull();
  });
});
