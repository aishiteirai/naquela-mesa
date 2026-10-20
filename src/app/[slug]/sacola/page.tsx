import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { formatOpenStatus, getOpenStatus, SLUG_PATTERN } from "@/modules/stores";
import { CartProvider } from "@/app/[slug]/_components/cart-context";
import { StoreShell } from "@/app/[slug]/_components/store-shell";
import { getStorePageData } from "@/app/[slug]/data";
import { Checkout } from "./_components/checkout";

export async function generateMetadata({ params }: PageProps<"/[slug]/sacola">): Promise<Metadata> {
  const { slug } = await params;
  if (slug.length > 60 || !SLUG_PATTERN.test(slug)) return {};
  const data = await getStorePageData(slug);
  if (!data) return {};
  return { title: `Sacola | ${data.store.name}` };
}

async function CheckoutContent({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (slug.length > 60 || !SLUG_PATTERN.test(slug)) notFound();
  const data = await getStorePageData(slug);
  if (!data) notFound();
  const { store, zones, menu } = data;
  // Aberto/fechado depende da hora: calculado a cada requisição (os dados da loja continuam em cache).
  await connection();
  const status = getOpenStatus({ hours: store.hours, manualStatus: store.manualStatus, timeZone: store.timezone, now: new Date() });

  return (
    <StoreShell theme={store.theme}>
      <CartProvider slug={store.slug}>
        <main className="flex flex-1 flex-col">
          <Checkout
            store={{
              slug: store.slug,
              address: store.address,
              features: { delivery: store.features.delivery, pickup: store.features.pickup, dineIn: store.features.dineIn },
              paymentMethods: store.paymentMethods,
              deliveryFee: store.rules.deliveryFee,
              minOrderCents: store.rules.minOrderCents,
              closedMessage: status.isOpen ? null : formatOpenStatus(status),
              zones: zones.map(({ neighborhood, feeCents }) => ({ neighborhood, feeCents })),
              pricing: {
                menu,
                halfPriceRule: store.rules.halfPriceRule,
                halfAndHalfEnabled: store.features.halfAndHalf,
                addonsEnabled: store.features.addons,
              },
            }}
          />
        </main>
      </CartProvider>
    </StoreShell>
  );
}

export default function SacolaPage({ params }: PageProps<"/[slug]/sacola">) {
  return (
    <Suspense fallback={<p className="p-6 text-muted-foreground">Carregando sacola...</p>}>
      <CheckoutContent params={params} />
    </Suspense>
  );
}
