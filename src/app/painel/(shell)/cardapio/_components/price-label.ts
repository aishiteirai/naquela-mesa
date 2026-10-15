import { startingPriceCents, type EditorProduct } from "@/modules/catalog";
import { formatBRL } from "@/shared/money";

export function editorPriceLabel(product: EditorProduct): string {
  const cents = startingPriceCents(product);
  if (cents === null) return "sem preço";
  return product.sizePrices.length > 0 ? `a partir de ${formatBRL(cents)}` : formatBRL(cents);
}
