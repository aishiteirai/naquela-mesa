import { formatOrderNumber, type Fulfillment, type OrderStatus } from "@/modules/orders/client";

export type StatusMessageInput = {
  customerName: string;
  number: number;
  status: OrderStatus;
  fulfillment: Fulfillment;
  storeName: string;
  trackingUrl: string;
  cancelReason: string | null;
};

export function buildStatusMessage(input: StatusMessageInput): string {
  const firstName = input.customerName.trim().split(/\s+/)[0] ?? input.customerName;
  const order = formatOrderNumber(input.number);
  const prefix = `Olá, ${firstName}!`;
  const lines: Record<OrderStatus, string> = {
    received: `${prefix} Recebemos seu pedido ${order} na ${input.storeName}.`,
    preparing: `${prefix} Seu pedido ${order} da ${input.storeName} está em preparo.`,
    out_for_delivery: `${prefix} Seu pedido ${order} da ${input.storeName} saiu para entrega.`,
    ready:
      input.fulfillment === "pickup"
        ? `${prefix} Seu pedido ${order} da ${input.storeName} está pronto para retirada.`
        : `${prefix} Seu pedido ${order} da ${input.storeName} está pronto.`,
    completed: `${prefix} Obrigado pelo pedido ${order} na ${input.storeName}.`,
    cancelled: `${prefix} Seu pedido ${order} da ${input.storeName} foi cancelado.${input.cancelReason ? ` Motivo: ${input.cancelReason}` : ""}`,
  };
  return `${lines[input.status]}\nAcompanhe: ${input.trackingUrl}`;
}
