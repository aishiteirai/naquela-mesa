import Link from "next/link";
import { startingPriceCents, type EditorCategory } from "@/modules/catalog";
import { formatBRL } from "@/shared/money";
import { moveCategoryAction, moveProductAction } from "@/app/painel/cardapio/actions";
import { CategoryForm } from "./category-form";
import { MoveButtons } from "./move-buttons";
import { SizesEditor } from "./sizes-editor";

function priceLabel(product: EditorCategory["products"][number]): string {
  const cents = startingPriceCents(product);
  if (cents === null) return "sem preço";
  return product.sizePrices.length > 0 ? `a partir de ${formatBRL(cents)}` : formatBRL(cents);
}

const badge = "rounded bg-neutral-200 px-2 py-0.5 text-xs font-medium text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100";

export function CategoryCard({ category, isFirst, isLast }: { category: EditorCategory; isFirst: boolean; isLast: boolean }) {
  return (
    <section aria-label={category.name} className="flex flex-col gap-4 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-semibold">{category.name}</h2>
        {!category.active && <span className={badge}>Inativa</span>}
        <div className="ml-auto">
          <MoveButtons action={moveCategoryAction} hidden={{ categoryId: category.id }} label={category.name} isFirst={isFirst} isLast={isLast} />
        </div>
      </div>

      <CategoryForm categoryId={category.id} name={category.name} active={category.active} />
      <SizesEditor categoryId={category.id} sizes={category.sizes} />

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold">Produtos</h3>
        <ul className="flex flex-col divide-y divide-neutral-200 dark:divide-neutral-800">
          {category.products.map((product, index) => (
            <li key={product.id} className="flex flex-wrap items-center gap-3 py-2">
              <span className="font-medium">{product.name}</span>
              <span className="text-sm text-neutral-700 dark:text-neutral-300">{priceLabel(product)}</span>
              {!product.active && <span className={badge}>Inativo</span>}
              {!product.available && <span className={badge}>Esgotado</span>}
              <div className="ml-auto flex items-center gap-2">
                <Link href={`/painel/cardapio/produtos/${product.id}`} aria-label={`Editar ${product.name}`} className="text-sm underline">
                  Editar
                </Link>
                <MoveButtons
                  action={moveProductAction}
                  hidden={{ productId: product.id }}
                  label={product.name}
                  isFirst={index === 0}
                  isLast={index === category.products.length - 1}
                />
              </div>
            </li>
          ))}
        </ul>
        <Link href={`/painel/cardapio/produtos/novo?categoria=${category.id}`} className="self-start text-sm underline">
          Novo produto
        </Link>
      </div>
    </section>
  );
}
