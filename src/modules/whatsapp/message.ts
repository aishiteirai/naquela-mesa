import { describeLine, formatOrderNumber, FULFILLMENT_LABELS, paymentLabel } from "@/modules/orders/client";
import type { PlacedOrder } from "@/modules/orders";
import { formatBRL } from "@/shared/money";

export function waMeLink(phoneE164: string, text: string): string {
  return `https://wa.me/${phoneE164.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;
}

export function buildOrderMessage(order: PlacedOrder, trackingUrl: string): string {
  const out: string[] = [
    `*Pedido ${formatOrderNumber(order.number)}* — ${order.store.name}`,
    FULFILLMENT_LABELS[order.fulfillment],
    `Cliente: ${order.customerName} (${order.customerPhone})`,
    "",
  ];

  for (const line of order.lines) {
    out.push(`${line.quantity}x ${describeLine(line)} — ${formatBRL(line.totalCents)}`);
    for (const option of line.options) out.push(`   + ${option.groupName}: ${option.optionName}`);
    if (line.notes) out.push(`   Obs.: ${line.notes}`);
  }

  out.push("", `Subtotal: ${formatBRL(order.subtotalCents)}`);
  if (order.fulfillment === "delivery") out.push(`Entrega: ${formatBRL(order.deliveryFeeCents)}`);
  out.push(`*Total: ${formatBRL(order.totalCents)}*`);
  const change = order.changeForCents ? ` (troco para ${formatBRL(order.changeForCents)})` : "";
  out.push(`Pagamento: ${paymentLabel(order.paymentMethod, order.fulfillment)}${change}`);

  const details: string[] = [];
  if (order.address) {
    const complement = order.address.complement ? ` - ${order.address.complement}` : "";
    details.push(`Endereço: ${order.address.street}, ${order.address.number}${complement} — ${order.address.neighborhood}`);
    if (order.address.reference) details.push(`Referência: ${order.address.reference}`);
  }
  if (order.tableLabel) details.push(`Mesa: ${order.tableLabel}`);
  if (order.notes) details.push(`Obs. do pedido: ${order.notes}`);
  if (details.length > 0) out.push("", ...details);

  out.push("", `Acompanhe: ${trackingUrl}`);
  return out.join("\n");
}

export function buildContactMessage(orderNumber: number, trackingUrl: string): string {
  return `Olá! Sobre o meu pedido ${formatOrderNumber(orderNumber)}: ${trackingUrl}`;
}
