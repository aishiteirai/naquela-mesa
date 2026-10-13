export type MenuSize = { id: string; name: string; maxFlavors: number };

export type MenuProduct = {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  priceCents: number | null;
  /** Preço por tamanho, na ordem dos tamanhos da categoria. */
  sizePrices: { sizeId: string; priceCents: number }[];
  allowsHalf: boolean;
  available: boolean;
  optionGroupIds: string[];
};

export type MenuCategory = { id: string; name: string; sizes: MenuSize[]; products: MenuProduct[] };

export type MenuOption = { id: string; name: string; priceCents: number; available: boolean };

export type MenuOptionGroup = { id: string; name: string; minSelect: number; maxSelect: number; options: MenuOption[] };

export type Menu = { categories: MenuCategory[]; optionGroups: MenuOptionGroup[] };

export function startingPriceCents(product: Pick<MenuProduct, "priceCents" | "sizePrices">): number | null {
  if (product.sizePrices.length > 0) return Math.min(...product.sizePrices.map((price) => price.priceCents));
  return product.priceCents;
}
