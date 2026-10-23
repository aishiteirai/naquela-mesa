import { statusLabel, type Fulfillment, type OrderStatus } from "@/modules/orders/client";

/** Rótulos curtos do tipo de pedido, só para o painel (o mapa global não muda). */
export const PANEL_FULFILLMENT_LABELS: Record<Fulfillment, string> = {
  delivery: "Delivery",
  pickup: "Retirada",
  dine_in: "Na mesa",
};

/** Rótulo do selo na fila: `received` vira "Novo"; o resto segue `statusLabel`. */
export function queueStatusLabel(status: OrderStatus, fulfillment: Fulfillment): string {
  if (status === "received") return "Novo";
  return statusLabel(status, fulfillment);
}
