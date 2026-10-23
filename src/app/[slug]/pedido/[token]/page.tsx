import type { Metadata } from "next";
import Image from "next/image";
import { ModeToggle } from "@/components/mode-toggle";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { cache, Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  FULFILLMENT_LABELS,
  formatOrderNumber,
  getOrderTracking,
  paymentLabel,
  statusLabel,
} from "@/modules/orders";
import { buildContactMessage, waMeLink } from "@/modules/whatsapp";
import { appUrl } from "@/shared/env";
import { formatBRL } from "@/shared/money";
import { StoreShell } from "@/app/[slug]/_components/store-shell";
import { AutoRefresh } from "./_components/auto-refresh";
import { OrderTimeline } from "./_components/order-timeline";

const FINAL_STATUSES = new Set(["completed", "cancelled"]);

// generateMetadata e a página leem o mesmo pedido: uma consulta só por requisição.
const readOrder = cache((token: string) => getOrderTracking(token));

const NO_INDEX = { index: false, follow: false } as const;

export async function generateMetadata({ params }: PageProps<"/[slug]/pedido/[token]">): Promise<Metadata> {
  const { token } = await params;
  await connection();
  const order = await readOrder(token);
  if (!order) return { robots: NO_INDEX };
  return { title: `Pedido ${formatOrderNumber(order.number)} - ${order.store.name}`, robots: NO_INDEX };
}

async function Tracking({
  params,
}: {
  params: Promise<{ slug: string; token: string }>;
}) {
  const { slug, token } = await params;
  await connection();
  const order = await readOrder(token);
  if (!order || order.store.slug !== slug) notFound();

  const path = `/${slug}/pedido/${token}`;
  const contactUrl = waMeLink(
    order.store.whatsappPhone,
    buildContactMessage(order.number, new URL(path, appUrl()).toString()),
  );
  const createdAt = new Intl.DateTimeFormat("pt-BR", {
    timeZone: order.store.timezone,
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(order.createdAt));

  return (
    <StoreShell theme={order.store.theme}>
      <main className="mx-auto flex w-full max-w-xl flex-col gap-5 px-4 py-6">
        {!FINAL_STATUSES.has(order.status) && <AutoRefresh intervalMs={10_000} />}

        <div className="flex items-center gap-3">
          <div className="size-10 shrink-0 overflow-hidden rounded-xl bg-primary">
            {order.store.logoUrl ? (
              <Image src={order.store.logoUrl} alt={`Logo de ${order.store.name}`} width={40} height={40} unoptimized className="size-full object-cover" />
            ) : (
              <span aria-hidden="true" className="grid size-full place-items-center font-bold text-primary-foreground">
                {order.store.name.charAt(0)}
              </span>
            )}
          </div>
          <span className="font-medium">{order.store.name}</span>
          <ModeToggle className="ml-auto" />
        </div>

        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold">Pedido {formatOrderNumber(order.number)}</h1>
          <p>Olá, {order.customerFirstName}!</p>
          <p className="text-sm text-muted-foreground">
            {FULFILLMENT_LABELS[order.fulfillment]} · feito em {createdAt}
          </p>
        </div>

        <p data-testid="order-status" className="text-lg font-semibold">
          {statusLabel(order.status, order.fulfillment)}
        </p>
        <OrderTimeline fulfillment={order.fulfillment} status={order.status} cancelReason={order.cancelReason} />

        <Card>
          <CardContent className="flex flex-col gap-4">
            <ul className="flex flex-col divide-y">
              {order.items.map((item, index) => (
                <li key={index} className="flex flex-col py-2">
                  <div className="flex justify-between gap-3">
                    <span>
                      {item.quantity}x {item.description}
                    </span>
                    <span>{formatBRL(item.totalCents)}</span>
                  </div>
                  {item.options.map((option) => (
                    <span key={option} className="text-sm text-muted-foreground">
                      + {option}
                    </span>
                  ))}
                </li>
              ))}
            </ul>
            <dl className="grid grid-cols-2 gap-1 text-sm">
              <dt className="text-muted-foreground">Subtotal</dt>
              <dd className="text-right">{formatBRL(order.subtotalCents)}</dd>
              {order.fulfillment === "delivery" && (
                <>
                  <dt className="text-muted-foreground">Entrega</dt>
                  <dd className="text-right">{formatBRL(order.deliveryFeeCents)}</dd>
                </>
              )}
              <dt className="font-semibold">Total</dt>
              <dd className="text-right font-semibold">{formatBRL(order.totalCents)}</dd>
              <dt className="text-muted-foreground">Pagamento</dt>
              <dd className="text-right">{paymentLabel(order.paymentMethod, order.fulfillment)}</dd>
            </dl>
          </CardContent>
        </Card>

        <a href={contactUrl} target="_blank" rel="noreferrer" className="rounded-lg bg-green-700 px-4 py-3 text-center font-semibold text-white">
          Falar com a loja no WhatsApp
        </a>
        <Button asChild variant="outline">
          <Link href={`/${slug}`}>Voltar ao cardápio</Link>
        </Button>
      </main>
    </StoreShell>
  );
}

export default function OrderPage({
  params,
}: PageProps<"/[slug]/pedido/[token]">) {
  return (
    <Suspense fallback={<p className="p-6 text-muted-foreground">Carregando pedido...</p>}>
      <Tracking params={params} />
    </Suspense>
  );
}
