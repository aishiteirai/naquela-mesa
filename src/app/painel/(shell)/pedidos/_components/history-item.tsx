import {
  formatOrderAddress,
  formatOrderNumber,
  FULFILLMENT_LABELS,
  PAYMENT_LABELS,
  statusLabel,
  type QueueOrder,
} from "@/modules/orders";
import { formatBRL } from "@/shared/money";

export function HistoryItem({ order, timeZone }: { order: QueueOrder; timeZone: string }) {
  const orderLabel = formatOrderNumber(order.number);
  const when = new Intl.DateTimeFormat("pt-BR", { timeZone, dateStyle: "short", timeStyle: "short" }).format(new Date(order.createdAt));

  return (
    <details aria-label={`Pedido ${orderLabel}`} className="rounded-lg border border-neutral-200 p-3 text-sm dark:border-neutral-800">
      <summary className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-bold">{orderLabel}</span>
        <span>{when}</span>
        <span>{order.customerName}</span>
        <span>{FULFILLMENT_LABELS[order.fulfillment]}</span>
        <span className="font-medium">{statusLabel(order.status, order.fulfillment)}</span>
        <span className="ml-auto font-semibold tabular-nums">{formatBRL(order.totalCents)}</span>
      </summary>
      <div className="mt-3 flex flex-col gap-1">
        <p>
          <a href={`tel:${order.customerPhone}`} className="underline">
            {order.customerPhone}
          </a>
        </p>
        {order.address && <p>{formatOrderAddress(order.address)}</p>}
        {order.tableLabel && <p>Mesa {order.tableLabel}</p>}
        <ul className="flex flex-col gap-1 border-y border-neutral-200 py-2 dark:border-neutral-800">
          {order.items.map((item, index) => (
            <li key={index}>
              <span className="font-medium">
                {item.quantity}x {item.description}
              </span>{" "}
              <span className="tabular-nums">{formatBRL(item.totalCents)}</span>
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
        </p>
        <p>
          Subtotal {formatBRL(order.subtotalCents)} · Entrega {formatBRL(order.deliveryFeeCents)} ·{" "}
          <span className="font-semibold">Total {formatBRL(order.totalCents)}</span>
        </p>
        {order.status === "cancelled" && order.cancelReason && (
          <p className="text-red-700 dark:text-red-400">Motivo: {order.cancelReason}</p>
        )}
        <a
          href={`/painel/pedidos/${order.id}/imprimir`}
          target="_blank"
          rel="noreferrer"
          aria-label={`Imprimir comanda ${orderLabel}`}
          className="w-fit underline"
        >
          Imprimir comanda
        </a>
      </div>
    </details>
  );
}
