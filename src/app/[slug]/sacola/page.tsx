import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { SLUG_PATTERN } from "@/modules/stores";
import { CartProvider } from "@/app/[slug]/_components/cart-context";
import { StoreShell } from "@/app/[slug]/_components/store-shell";
import { getStorePageData } from "@/app/[slug]/data";
import { Checkout } from "./_components/checkout";

async function CheckoutContent({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (slug.length > 60 || !SLUG_PATTERN.test(slug)) notFound();
  const data = await getStorePageData(slug);
  if (!data) notFound();
  const { store, zones } = data;

  return (
    <StoreShell theme={store.theme}>
      <title>{`Sacola | ${store.name}`}</title>
      <CartProvider slug={store.slug}>
        <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-6">
          <Link href={`/${store.slug}`} className="text-sm underline">
            ← Voltar ao cardápio
          </Link>
          <h1 className="text-2xl font-semibold">Sua sacola</h1>
          <Checkout
            store={{
              slug: store.slug,
              features: { delivery: store.features.delivery, pickup: store.features.pickup, dineIn: store.features.dineIn },
              paymentMethods: store.paymentMethods,
              deliveryFee: store.rules.deliveryFee,
              zones: zones.map(({ neighborhood, feeCents }) => ({ neighborhood, feeCents })),
            }}
          />
        </main>
      </CartProvider>
    </StoreShell>
  );
}

export default function SacolaPage({ params }: PageProps<"/[slug]/sacola">) {
  return (
    <Suspense fallback={<p className="p-6">Carregando sacola...</p>}>
      <CheckoutContent params={params} />
    </Suspense>
  );
}
