import { Suspense } from "react";
import { notFound } from "next/navigation";
import { SLUG_PATTERN } from "@/modules/stores";
import { CartBar } from "./_components/cart-bar";
import { CartProvider } from "./_components/cart-context";
import { CategoryNav, categoryAnchor } from "./_components/category-nav";
import { MenuProvider } from "./_components/menu-provider";
import { OpenStatus } from "./_components/open-status";
import { ProductCard } from "./_components/product-card";
import { StoreFooter } from "./_components/store-footer";
import { StoreHeader } from "./_components/store-header";
import { StoreShell } from "./_components/store-shell";
import { getStorePageData } from "./data";

async function StoreMenu({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (slug.length > 60 || !SLUG_PATTERN.test(slug)) notFound();
  const data = await getStorePageData(slug);
  if (!data) notFound();
  const { store, menu } = data;

  return (
    <StoreShell theme={store.theme}>
      <title>{`${store.name} | Naquela Mesa`}</title>
      <MenuProvider
        value={{
          menu,
          halfPriceRule: store.rules.halfPriceRule,
          halfAndHalfEnabled: store.features.halfAndHalf,
          addonsEnabled: store.features.addons,
        }}
      >
        <CartProvider key={store.slug} slug={store.slug}>
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
          <StoreFooter />
          <CartBar slug={store.slug} />
        </CartProvider>
      </MenuProvider>
    </StoreShell>
  );
}

export default function StorePage({ params }: PageProps<"/[slug]">) {
  return (
    <Suspense fallback={<p className="p-6 text-neutral-700 dark:text-neutral-300">Carregando cardápio...</p>}>
      <StoreMenu params={params} />
    </Suspense>
  );
}
