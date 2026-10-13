import type { CSSProperties } from "react";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { SLUG_PATTERN, themeCssVariables } from "@/modules/stores";
import { CategoryNav, categoryAnchor } from "./_components/category-nav";
import { OpenStatus } from "./_components/open-status";
import { ProductCard } from "./_components/product-card";
import { StoreHeader } from "./_components/store-header";
import { getStorePageData } from "./data";

async function StoreMenu({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (slug.length > 60 || !SLUG_PATTERN.test(slug)) notFound();
  const data = await getStorePageData(slug);
  if (!data) notFound();
  const { store, menu } = data;

  return (
    <div style={themeCssVariables(store.theme) as CSSProperties} className="flex flex-1 flex-col">
      <title>{`${store.name} | Naquela Mesa`}</title>
      <StoreHeader
        store={store}
        status={
          <Suspense fallback={<span className="text-sm opacity-90">Verificando horário...</span>}>
            <OpenStatus store={store} />
          </Suspense>
        }
      />
      <CategoryNav categories={menu.categories} />
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-6">
        {menu.categories.map((category) => (
          <section key={category.id} id={categoryAnchor(category.id)} className="scroll-mt-16">
            <h2 className="mb-3 text-xl font-bold">{category.name}</h2>
            <div className="flex flex-col gap-3">
              {category.products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </section>
        ))}
      </main>
    </div>
  );
}

export default function StorePage({ params }: PageProps<"/[slug]">) {
  return (
    <Suspense fallback={<p className="p-6 text-neutral-700 dark:text-neutral-300">Carregando cardápio...</p>}>
      <StoreMenu params={params} />
    </Suspense>
  );
}
