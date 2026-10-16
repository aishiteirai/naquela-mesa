type UsageProduct = { id: string; name: string; categoryId: string };

/** Para cada grupo de adicionais, os produtos que o usam, na ordem do cardápio. */
export function groupUsage(categories: { products: (UsageProduct & { optionGroupIds: string[] })[] }[]): Map<string, UsageProduct[]> {
  const usage = new Map<string, UsageProduct[]>();
  for (const category of categories) {
    for (const { optionGroupIds, ...product } of category.products) {
      for (const groupId of optionGroupIds) usage.set(groupId, [...(usage.get(groupId) ?? []), product]);
    }
  }
  return usage;
}
