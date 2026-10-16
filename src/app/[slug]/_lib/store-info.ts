import type { Store } from "@/modules/stores";
import { formatBRL } from "@/shared/money";

type Input = Pick<Store, "features" | "rules"> & { zones: { feeCents: number }[] };

function deliveryFee(input: Input): string {
  const fee = input.rules.deliveryFee;
  if (fee.strategy === "fixed") return fee.fixedCents > 0 ? `Taxa ${formatBRL(fee.fixedCents)}` : "Entrega grátis";
  if (input.zones.length === 0) return "Taxa por bairro";
  const cheapest = Math.min(...input.zones.map((zone) => zone.feeCents));
  return cheapest > 0 ? `Taxa a partir de ${formatBRL(cheapest)}` : "Taxa por bairro";
}

/** O que o cliente quer saber antes de montar o pedido: tempos, taxa de entrega e pedido mínimo. */
export function storeInfo(input: Input): string[] {
  const info: string[] = [];
  if (input.features.delivery) info.push(`Entrega ~${input.rules.deliveryTimeMin} min`, deliveryFee(input));
  if (input.features.pickup) info.push(`Retirada ~${input.rules.prepTimeMin} min`);
  if (input.rules.minOrderCents > 0) info.push(`Pedido mínimo ${formatBRL(input.rules.minOrderCents)}`);
  return info;
}
