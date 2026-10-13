import Image from "next/image";
import { startingPriceCents, type MenuProduct } from "@/modules/catalog";
import { formatBRL } from "@/shared/money";

function priceLabel(product: MenuProduct): string | null {
  const cents = startingPriceCents(product);
  if (cents === null) return null;
  return product.sizePrices.length > 0 ? `a partir de ${formatBRL(cents)}` : formatBRL(cents);
}

export function ProductCard({ product }: { product: MenuProduct }) {
  const price = priceLabel(product);

  return (
    <article
      className={`flex gap-4 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800 ${product.available ? "" : "opacity-60"}`}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <h3 className="font-semibold">{product.name}</h3>
        {product.description && <p className="text-sm text-neutral-700 dark:text-neutral-300">{product.description}</p>}
        <div className="mt-auto flex items-center gap-2 pt-2">
          {price && <span className="font-medium">{price}</span>}
          {!product.available && (
            <span className="rounded bg-neutral-900 px-2 py-0.5 text-xs font-semibold text-white dark:bg-neutral-100 dark:text-neutral-900">
              Esgotado
            </span>
          )}
        </div>
      </div>
      {product.imageUrl && (
        <Image src={product.imageUrl} alt="" width={96} height={96} unoptimized className="size-24 shrink-0 rounded-md object-cover" />
      )}
    </article>
  );
}
