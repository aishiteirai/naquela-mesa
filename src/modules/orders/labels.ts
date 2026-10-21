import type { Fulfillment, OrderAddress, OrderChannel, OrderStatus, PaymentMethod } from "./types";

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
  on_pickup: "Pagar na retirada",
};

/** "Cartão na entrega" só faz sentido no delivery; na retirada e na mesa é a maquininha da loja. */
export function paymentLabel(method: PaymentMethod, fulfillment: Fulfillment): string {
  if (method === "card_on_delivery" && fulfillment !== "delivery") return "Cartão (maquininha)";
  return PAYMENT_LABELS[method];
}

export const FULFILLMENT_LABELS: Record<Fulfillment, string> = {
  delivery: "Delivery",
  pickup: "Retirada no balcão",
  dine_in: "Consumo no local",
};

export const CHANNEL_LABELS: Record<OrderChannel, string> = {
  web: "Cardápio online",
  whatsapp: "WhatsApp",
};

export function formatOrderAddress(address: OrderAddress): string {
  return (
    `${address.street}, ${address.number}` +
    (address.complement ? ` - ${address.complement}` : "") +
    ` — ${address.neighborhood}` +
    (address.reference ? ` (ref.: ${address.reference})` : "")
  );
}
