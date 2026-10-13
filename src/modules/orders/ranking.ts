export type RankableLine = { productName: string; sizeName: string | null; flavors: string[]; quantity: number; totalCents: number };
export type RankedProduct = { name: string; quantity: number; revenueCents: number };

/** Top produtos: pizza conta por sabor (meio a meio = ½ para cada); demais itens pelo nome. */
export function rankProducts(lines: RankableLine[], limit = 10): RankedProduct[] {
  const totals = new Map<string, { quantity: number; revenue: number }>();
  for (const line of lines) {
    const names = line.sizeName !== null && line.flavors.length > 0 ? line.flavors : [line.productName];
    for (const name of names) {
      const entry = totals.get(name) ?? { quantity: 0, revenue: 0 };
      entry.quantity += line.quantity / names.length;
      entry.revenue += line.totalCents / names.length;
      totals.set(name, entry);
    }
  }

  return [...totals]
    .map(([name, entry]) => ({ name, quantity: Math.round(entry.quantity * 100) / 100, revenueCents: Math.round(entry.revenue) }))
    .sort((a, b) => b.quantity - a.quantity || b.revenueCents - a.revenueCents || a.name.localeCompare(b.name, "pt-BR"))
    .slice(0, limit);
}

export function formatQuantity(quantity: number): string {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(quantity);
}
