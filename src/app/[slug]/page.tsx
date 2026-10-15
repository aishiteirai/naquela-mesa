import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { SLUG_PATTERN } from "@/modules/stores";
import { CartBar } from "./_components/cart-bar";
import { CartProvider } from "./_components/cart-context";
import { CategoryNav } from "./_components/category-nav";
import { ItemParamController } from "./_components/item-param-controller";
import { MenuProvider } from "./_components/menu-provider";
import { OpenStatus } from "./_components/open-status";
import { ProductRow } from "./_components/product-row";
import { StoreFooter } from "./_components/store-footer";
import { StoreHeader } from "./_components/store-header";
import { StoreShell } from "./_components/store-shell";
import { categoryAnchor } from "./_lib/anchors";
import { priceLabel } from "./_lib/price-label";
import { getStorePageData } from "./data";

export async function generateMetadata({ params }: PageProps<"/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  if (slug.length > 60 || !SLUG_PATTERN.test(slug)) return {};
  const data = await getStorePageData(slug);
  if (!data) return {};
  return { title: `${data.store.name} | Naquela Mesa` };
}

async function StoreMenu({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (slug.length > 60 || !SLUG_PATTERN.test(slug)) notFound();
  const data = await getStorePageData(slug);
  if (!data) notFound();
  const { store, menu } = data;

  return (
    <StoreShell theme={store.theme}>
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
              <Suspense fallback={<Badge variant="secondary">Verificando horário...</Badge>}>
                <OpenStatus store={store} />
              </Suspense>
            }
          />
          <CategoryNav categories={menu.categories.map(({ id, name }) => ({ id, name }))} />
          <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-4">
            {menu.categories.map((category) => (
              <section key={category.id} id={categoryAnchor(category.id)} aria-labelledby={`${categoryAnchor(category.id)}-title`} className="scroll-mt-16">
                <h2 id={`${categoryAnchor(category.id)}-title`} className="text-xl font-bold">
                  {category.name}
                </h2>
                <div className="divide-y">
                  {category.products.map((product) => (
                    <ProductRow key={product.id} product={product} price={priceLabel(product)} />
                  ))}
                </div>
              </section>
            ))}
          </main>
          <StoreFooter />
          <ItemParamController />
          <CartBar slug={store.slug} />
        </CartProvider>
      </MenuProvider>
    </StoreShell>
  );
}

export default function StorePage({ params }: PageProps<"/[slug]">) {
  return (
    <Suspense fallback={<p className="p-6 text-muted-foreground">Carregando cardápio...</p>}>
      <StoreMenu params={params} />
    </Suspense>
  );
}
