import { normalizeBrazilPhone } from "@/modules/orders";

/** Chave do limite por telefone: a mesma normalização que o pedido usa; null se ausente ou inválido. */
export function phoneRateLimitKey(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null) return null;
  const phone = (payload as { customer?: { phone?: unknown } }).customer?.phone;
  return typeof phone === "string" ? normalizeBrazilPhone(phone) : null;
}
