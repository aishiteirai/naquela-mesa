import type { MenuCategory } from "@/modules/catalog";

export function categoryAnchor(categoryId: string): string {
  return `categoria-${categoryId}`;
}

export function CategoryNav({ categories }: { categories: MenuCategory[] }) {
  return (
    <nav aria-label="Categorias" className="sticky top-0 z-10 border-b border-neutral-200 bg-background dark:border-neutral-800">
      <ul className="mx-auto flex max-w-3xl gap-2 overflow-x-auto px-4 py-3">
        {categories.map((category) => (
          <li key={category.id} className="shrink-0">
            <a
              href={`#${categoryAnchor(category.id)}`}
              className="block rounded-full bg-(--brand-secondary) px-4 py-1.5 text-sm font-medium text-(--brand-secondary-foreground)"
            >
              {category.name}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
