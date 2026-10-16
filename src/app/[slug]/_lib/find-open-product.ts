import type { MenuCategory, MenuProduct } from "@/modules/catalog";

// Só abre produto que existe e está disponível.
export function findOpenableProduct(productId: string | null, categories: MenuCategory[]): MenuProduct | null {
  if (!productId) return null;
  for (const category of categories) {
    const product = category.products.find((item) => item.id === productId);
    if (product) return product.available ? product : null;
  }
  return null;
}
