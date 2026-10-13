import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { FULFILLMENT_LABELS, formatOrderNumber, getOrderTracking, PAYMENT_LABELS, statusLabel } from "@/modules/orders";
import { buildContactMessage, waMeLink } from "@/modules/whatsapp";
import { getEnv } from "@/shared/env";
import { formatBRL } from "@/shared/money";
import { AutoRefresh } from "./_components/auto-refresh";

const FINAL_STATUSES = new Set(["completed", "cancelled"]);

async function Tracking({ params }: { params: Promise<{ slug: string; token: string }> }) {
  const { slug, token } = await params;
  await connection();
  const order = await getOrderTracking(token);
  if (!order || order.store.slug !== slug) notFound();

  const path = `/${slug}/pedido/${token}`;
  const contactUrl = waMeLink(order.store.whatsappPhone, buildContactMessage(order.number, new URL(path, getEnv().BETTER_AUTH_URL).toString()));
  const createdAt = new Intl.DateTimeFormat("pt-BR", { timeZone: order.store.timezone, dateStyle: "short", timeStyle: "short" }).format(
    new Date(order.createdAt),
  );

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-5 px-4 py-6">
      <title>{`Pedido ${formatOrderNumber(order.number)} | ${order.store.name}`}</title>
      <meta name="robots" content="noindex, nofollow" />
      {!FINAL_STATUSES.has(order.status) && <AutoRefresh intervalMs={10_000} />}
      <p className="text-sm text-neutral-700 dark:text-neutral-300">{order.store.name}</p>
      <h1 className="text-2xl font-semibold">Pedido {formatOrderNumber(order.number)}</h1>
      <p>Olá, {order.customerFirstName}!</p>
      <p data-testid="order-status" className="rounded-lg bg-neutral-100 p-3 text-lg font-semibold dark:bg-neutral-800">
        {statusLabel(order.status, order.fulfillment)}
      </p>
      <p className="text-sm text-neutral-700 dark:text-neutral-300">
        {FULFILLMENT_LABELS[order.fulfillment]} · feito em {createdAt}
      </p>

      <ul className="flex flex-col divide-y divide-neutral-200 dark:divide-neutral-800">
        {order.items.map((item, index) => (
          <li key={index} className="flex flex-col py-2">
            <div className="flex justify-between gap-3">
              <span>
                {item.quantity}x {item.description}
              </span>
              <span>{formatBRL(item.totalCents)}</span>
            </div>
            {item.options.map((option) => (
              <span key={option} className="text-sm text-neutral-700 dark:text-neutral-300">
                + {option}
              </span>
            ))}
          </li>
        ))}
      </ul>

      <dl className="grid grid-cols-2 gap-1">
        <dt>Subtotal</dt>
        <dd className="text-right">{formatBRL(order.subtotalCents)}</dd>
        <dt>Entrega</dt>
        <dd className="text-right">{formatBRL(order.deliveryFeeCents)}</dd>
        <dt className="font-semibold">Total</dt>
        <dd className="text-right font-semibold">{formatBRL(order.totalCents)}</dd>
        <dt>Pagamento</dt>
        <dd className="text-right">{PAYMENT_LABELS[order.paymentMethod]}</dd>
      </dl>

      <a href={contactUrl} target="_blank" rel="noreferrer" className="rounded bg-green-700 px-4 py-3 text-center font-semibold text-white">
        Falar com a loja no WhatsApp
      </a>
      <Link href={`/${slug}`} className="text-center underline">
        Voltar ao cardápio
      </Link>
    </main>
  );
}

export default function OrderPage({ params }: PageProps<"/[slug]/pedido/[token]">) {
  return (
    <Suspense fallback={<p className="p-6">Carregando pedido...</p>}>
      <Tracking params={params} />
    </Suspense>
  );
}
