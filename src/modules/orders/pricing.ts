import type { Menu, MenuCategory, MenuOptionGroup, MenuProduct } from "@/modules/catalog";
import { DomainError } from "@/shared/errors";

export type CartItemInput =
  | { kind: "simple"; productId: string; optionIds: string[]; quantity: number; notes: string | null }
  | { kind: "sized"; sizeId: string; flavorIds: string[]; optionIds: string[]; quantity: number; notes: string | null };

export type PricedOption = { groupName: string; optionName: string; priceCents: number };

export type PricedLine = {
  productName: string;
  sizeName: string | null;
  flavors: string[];
  options: PricedOption[];
  quantity: number;
  unitPriceCents: number;
  totalCents: number;
  notes: string | null;
};

export type PricingContext = {
  menu: Menu;
  halfPriceRule: "highest" | "average";
  halfAndHalfEnabled: boolean;
  addonsEnabled: boolean;
};

export const MAX_ITEM_QUANTITY = 50;

function unavailable(itemIndex: number, name: string): DomainError {
  return new DomainError("ITEM_UNAVAILABLE", { itemIndex, name });
}

function invalidOptions(itemIndex: number, reason: string): DomainError {
  return new DomainError("INVALID_OPTIONS", { itemIndex, reason });
}

function findProduct(menu: Menu, productId: string): MenuProduct | null {
  for (const category of menu.categories) {
    const product = category.products.find((item) => item.id === productId);
    if (product) return product;
  }
  return null;
}

function findSize(menu: Menu, sizeId: string): { size: MenuCategory["sizes"][number]; category: MenuCategory } | null {
  for (const category of menu.categories) {
    const size = category.sizes.find((item) => item.id === sizeId);
    if (size) return { size, category };
  }
  return null;
}

function priceOptions(ctx: PricingContext, itemIndex: number, groupIds: string[], optionIds: string[]): PricedOption[] {
  if (!ctx.addonsEnabled) {
    if (optionIds.length > 0) throw invalidOptions(itemIndex, "adicionais indisponíveis");
    return [];
  }
  if (new Set(optionIds).size !== optionIds.length) throw invalidOptions(itemIndex, "adicional repetido");

  const remaining = new Set(optionIds);
  const priced: PricedOption[] = [];
  const groups = groupIds
    .map((groupId) => ctx.menu.optionGroups.find((group) => group.id === groupId))
    .filter((group): group is MenuOptionGroup => group !== undefined);

  for (const group of groups) {
    const chosen = group.options.filter((option) => remaining.has(option.id));
    for (const option of chosen) remaining.delete(option.id);

    if (chosen.length < group.minSelect) throw invalidOptions(itemIndex, `escolha ao menos ${group.minSelect} em ${group.name}`);
    if (chosen.length > group.maxSelect) throw invalidOptions(itemIndex, `escolha no máximo ${group.maxSelect} em ${group.name}`);

    for (const option of chosen) {
      if (!option.available) throw unavailable(itemIndex, option.name);
      priced.push({ groupName: group.name, optionName: option.name, priceCents: option.priceCents });
    }
  }

  if (remaining.size > 0) throw invalidOptions(itemIndex, "adicional não pertence a este item");
  return priced;
}

export function priceItem(ctx: PricingContext, item: CartItemInput, itemIndex: number): PricedLine {
  if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > MAX_ITEM_QUANTITY) {
    throw new DomainError("VALIDATION", { issues: [{ path: `items.${itemIndex}.quantity`, message: "quantidade inválida" }] });
  }

  let baseCents: number;
  let productName: string;
  let sizeName: string | null = null;
  let flavors: string[] = [];
  let groupIds: string[];

  if (item.kind === "simple") {
    const product = findProduct(ctx.menu, item.productId);
    if (!product) throw unavailable(itemIndex, "item");
    if (product.priceCents === null || product.sizePrices.length > 0) throw invalidOptions(itemIndex, "escolha um tamanho");
    if (!product.available) throw unavailable(itemIndex, product.name);
    baseCents = product.priceCents;
    productName = product.name;
    groupIds = product.optionGroupIds;
  } else {
    const found = findSize(ctx.menu, item.sizeId);
    if (!found) throw unavailable(itemIndex, "tamanho");
    const { size, category } = found;
    const ids = item.flavorIds;
    if (ids.length < 1 || ids.length > size.maxFlavors || new Set(ids).size !== ids.length) {
      throw invalidOptions(itemIndex, `escolha de 1 a ${size.maxFlavors} sabores`);
    }

    const flavorProducts: MenuProduct[] = [];
    for (const flavorId of ids) {
      const product = category.products.find((candidate) => candidate.id === flavorId);
      if (!product) throw unavailable(itemIndex, "sabor");
      flavorProducts.push(product);
    }
    if (flavorProducts.length > 1 && (!ctx.halfAndHalfEnabled || flavorProducts.some((product) => !product.allowsHalf))) {
      throw invalidOptions(itemIndex, "meio a meio indisponível para estes sabores");
    }

    const prices = flavorProducts.map((product) => {
      if (!product.available) throw unavailable(itemIndex, product.name);
      const price = product.sizePrices.find((candidate) => candidate.sizeId === size.id);
      if (!price) throw unavailable(itemIndex, `${product.name} (${size.name})`);
      return price.priceCents;
    });

    baseCents =
      ctx.halfPriceRule === "highest"
        ? Math.max(...prices)
        : Math.ceil(prices.reduce((sum, price) => sum + price, 0) / prices.length);
    productName = flavorProducts.map((product) => product.name).join(" / ");
    sizeName = size.name;
    flavors = flavorProducts.map((product) => product.name);
    groupIds = [...new Set(flavorProducts.flatMap((product) => product.optionGroupIds))];
  }

  const options = priceOptions(ctx, itemIndex, groupIds, item.optionIds);
  const unitPriceCents = baseCents + options.reduce((sum, option) => sum + option.priceCents, 0);

  return {
    productName,
    sizeName,
    flavors,
    options,
    quantity: item.quantity,
    unitPriceCents,
    totalCents: unitPriceCents * item.quantity,
    notes: item.notes?.trim() || null,
  };
}

export function priceCart(ctx: PricingContext, items: CartItemInput[]): { lines: PricedLine[]; subtotalCents: number } {
  if (items.length === 0) {
    throw new DomainError("VALIDATION", { issues: [{ path: "items", message: "sua sacola está vazia" }] });
  }
  const lines = items.map((item, index) => priceItem(ctx, item, index));
  return { lines, subtotalCents: lines.reduce((sum, line) => sum + line.totalCents, 0) };
}

export function describeLine(line: Pick<PricedLine, "productName" | "sizeName" | "flavors">): string {
  if (line.sizeName === null) return line.productName;
  if (line.flavors.length > 1) return `${line.sizeName} — ${line.flavors.map((flavor) => `½ ${flavor}`).join(" + ")}`;
  return `${line.flavors[0] ?? line.productName} (${line.sizeName})`;
}
