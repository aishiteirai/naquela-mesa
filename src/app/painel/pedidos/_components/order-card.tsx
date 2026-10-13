import {
  advanceLabel,
  FULFILLMENT_LABELS,
  formatOrderNumber,
  isFinalStatus,
  nextStatus,
  PAYMENT_LABELS,
  statusLabel,
  type QueueOrder,
} from "@/modules/orders";
import { buildStatusMessage, waMeLink } from "@/modules/whatsapp";
import { getEnv } from "@/shared/env";
import { formatBRL } from "@/shared/money";
import { AdvanceButton } from "./advance-button";
import { CancelForm } from "./cancel-form";

type Props = { order: QueueOrder; storeName: string; storeSlug: string; timezone: string; autoPrintOnAccept: boolean };

export function OrderCard({ order, storeName, storeSlug, timezone, autoPrintOnAccept }: Props) {
  const orderLabel = formatOrderNumber(order.number);
  const time = new Intl.DateTimeFormat("pt-BR", { timeZone: timezone, hour: "2-digit", minute: "2-digit" }).format(new Date(order.createdAt));
  const next = nextStatus(order.fulfillment, order.status);
  const label = advanceLabel(order.fulfillment, order.status);
  const trackingUrl = new URL(`/${storeSlug}/pedido/${order.publicToken}`, getEnv().BETTER_AUTH_URL).toString();
  const notifyUrl = waMeLink(
    order.customerPhone,
    buildStatusMessage({
      customerName: order.customerName,
      number: order.number,
      status: order.status,
      fulfillment: order.fulfillment,
      storeName,
      trackingUrl,
      cancelReason: order.cancelReason,
    }),
  );
  const changeCents = order.changeForCents ? order.changeForCents - order.totalCents : null;

  return (
    <article aria-label={`Pedido ${orderLabel}`} className="flex flex-col gap-2 rounded-lg border border-neutral-200 p-3 text-sm dark:border-neutral-800">
      <div className="flex items-center justify-between gap-2">
        <span className="text-base font-bold">{orderLabel}</span>
        <span className="text-neutral-700 dark:text-neutral-300">{time}</span>
      </div>
      <p className="font-medium">
        {statusLabel(order.status, order.fulfillment)} · {FULFILLMENT_LABELS[order.fulfillment]}
      </p>
      <p>
        {order.customerName} ·{" "}
        <a href={`tel:${order.customerPhone}`} className="underline">
          {order.customerPhone}
        </a>
      </p>
      {order.address && (
        <p>
          {order.address.street}, {order.address.number}
          {order.address.complement ? ` - ${order.address.complement}` : ""} — {order.address.neighborhood}
          {order.address.reference ? ` (ref.: ${order.address.reference})` : ""}
        </p>
      )}
      {order.tableLabel && <p>Mesa {order.tableLabel}</p>}
      <ul className="flex flex-col gap-1 border-y border-neutral-200 py-2 dark:border-neutral-800">
        {order.items.map((item, index) => (
          <li key={index}>
            <span className="font-medium">
              {item.quantity}x {item.description}
            </span>
            {item.options.map((option) => (
              <span key={option} className="block pl-3 text-neutral-700 dark:text-neutral-300">
                + {option}
              </span>
            ))}
            {item.notes && <span className="block pl-3 italic">Obs.: {item.notes}</span>}
          </li>
        ))}
      </ul>
      {order.notes && <p className="italic">Obs. do pedido: {order.notes}</p>}
      <p>
        {PAYMENT_LABELS[order.paymentMethod]}
        {order.changeForCents ? ` · troco para ${formatBRL(order.changeForCents)}` : ""}
        {changeCents !== null && changeCents > 0 ? ` (levar ${formatBRL(changeCents)})` : ""}
      </p>
      <p className="font-semibold">Total {formatBRL(order.totalCents)}</p>
      {order.status === "cancelled" && order.cancelReason && <p className="text-red-700 dark:text-red-400">Motivo: {order.cancelReason}</p>}
      <div className="flex flex-wrap items-center gap-2">
        {next && label && (
          <AdvanceButton
            orderId={order.id}
            to={next}
            label={label}
            orderLabel={orderLabel}
            printUrl={autoPrintOnAccept && order.status === "received" ? `/painel/pedidos/${order.id}/imprimir` : undefined}
          />
        )}
        <a href={notifyUrl} target="_blank" rel="noreferrer" aria-label={`Avisar cliente ${orderLabel}`} className="text-sm underline">
          Avisar cliente
        </a>
        {!isFinalStatus(order.status) && <CancelForm orderId={order.id} orderLabel={orderLabel} />}
      </div>
    </article>
  );
}
