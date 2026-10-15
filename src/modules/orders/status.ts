import type { Fulfillment, OrderStatus } from "./types";

export const FINAL_STATUSES: ReadonlySet<OrderStatus> = new Set<OrderStatus>(["completed", "cancelled"]);

const FLOWS: Record<Fulfillment, OrderStatus[]> = {
  delivery: ["received", "preparing", "out_for_delivery", "completed"],
  pickup: ["received", "preparing", "ready", "completed"],
  dine_in: ["received", "preparing", "ready", "completed"],
};

export function isFinalStatus(status: OrderStatus): boolean {
  return FINAL_STATUSES.has(status);
}

export function nextStatus(fulfillment: Fulfillment, status: OrderStatus): OrderStatus | null {
  if (isFinalStatus(status)) return null;
  const flow = FLOWS[fulfillment];
  const index = flow.indexOf(status);
  return index === -1 ? null : (flow[index + 1] ?? null);
}

export function canTransition(fulfillment: Fulfillment, from: OrderStatus, to: OrderStatus): boolean {
  if (isFinalStatus(from)) return false;
  if (to === "cancelled") return true;
  return nextStatus(fulfillment, from) === to;
}

export function advanceLabel(fulfillment: Fulfillment, status: OrderStatus): string | null {
  switch (status) {
    case "received":
      return "Aceitar";
    case "preparing":
      return fulfillment === "delivery" ? "Saiu para entrega" : "Pronto";
    case "out_for_delivery":
    case "ready":
      return "Concluir";
    default:
      return null;
  }
}

export type TimelineStep = { status: OrderStatus; state: "done" | "current" | "upcoming" };

// Etapas do fluxo do pedido para o acompanhamento do cliente; cancelado não tem linha do tempo.
export function timelineFor(fulfillment: Fulfillment, status: OrderStatus): TimelineStep[] | null {
  if (status === "cancelled") return null;
  const flow = FLOWS[fulfillment];
  const index = flow.indexOf(status);
  return flow.map((step, position) => ({
    status: step,
    state: position < index || status === "completed" ? "done" : position === index ? "current" : "upcoming",
  }));
}
