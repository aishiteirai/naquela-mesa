import type { Fulfillment, OrderStatus, PaymentMethod } from "./types";

export function formatOrderNumber(orderNumber: number): string {
  return `#${String(orderNumber).padStart(4, "0")}`;
}

const STATUS_LABELS: Record<OrderStatus, string> = {
  received: "Recebido — aguardando a loja",
  preparing: "Em preparo",
  out_for_delivery: "Saiu para entrega",
  ready: "Pronto",
  completed: "Concluído",
  cancelled: "Cancelado",
};

export function statusLabel(status: OrderStatus, fulfillment: Fulfillment): string {
  if (status === "ready" && fulfillment === "pickup") return "Pronto para retirada";
  return STATUS_LABELS[status];
}

export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  cash: "Dinheiro",
  card_on_delivery: "Cartão na entrega",
  pix: "Pix",
};

export const FULFILLMENT_LABELS: Record<Fulfillment, string> = {
  delivery: "Delivery",
  pickup: "Retirada no balcão",
  dine_in: "Consumo no local",
};
