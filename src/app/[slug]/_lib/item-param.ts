import type { MenuCategory, MenuProduct } from "@/modules/catalog";

export const ITEM_PARAM = "item";

// ?item=<id> só abre produto que existe e está disponível.
export function parseItemParam(value: string | null, categories: MenuCategory[]): MenuProduct | null {
  if (!value) return null;
  for (const category of categories) {
    const product = category.products.find((item) => item.id === value);
    if (product) return product.available ? product : null;
  }
  return null;
}
