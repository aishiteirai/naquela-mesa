import { startingPriceCents, type MenuProduct } from "@/modules/catalog";
import { formatBRL } from "@/shared/money";

export function priceLabel(product: MenuProduct): string | null {
  const cents = startingPriceCents(product);
  if (cents === null) return null;
  return product.sizePrices.length > 0 ? `a partir de ${formatBRL(cents)}` : formatBRL(cents);
}
