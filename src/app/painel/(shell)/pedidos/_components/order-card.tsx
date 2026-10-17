import {
  advanceLabel,
  FULFILLMENT_LABELS,
  formatOrderAddress,
  formatOrderNumber,
  isFinalStatus,
  nextStatus,
  PAYMENT_LABELS,
  type QueueOrder,
} from "@/modules/orders";
import type { ComponentType } from "react";
import { BanknoteIcon, BikeIcon, MapPinIcon, MessageCircleIcon, PhoneIcon, PrinterIcon, ShoppingBagIcon, UtensilsCrossedIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "cn";
import { PANEL_FULFILLMENT_LABELS, queueStatusLabel } from "@/app/painel/_lib/labels";
import { buildStatusMessage, waMeLink } from "@/modules/whatsapp";
import { appUrl } from "@/shared/env";
import { formatBRL } from "@/shared/money";
import { AdvanceButton } from "./advance-button";
import { CancelForm } from "./cancel-form";
import { OrderTime } from "./order-time";

const FULFILLMENT_ICONS: Record<QueueOrder["fulfillment"], ComponentType<{ className?: string }>> = {
  delivery: BikeIcon,
  pickup: ShoppingBagIcon,
  dine_in: UtensilsCrossedIcon,
};

const STATUS_BADGE: Record<QueueOrder["status"], string> = {
  received: "bg-primary text-primary-foreground",
  preparing: "bg-ok text-ok-foreground",
  ready: "border-border bg-muted text-foreground",
  out_for_delivery: "border-border bg-muted text-foreground",
  completed: "bg-ok text-ok-foreground",
  cancelled: "bg-[#FDECEC] text-[#B42318]",
};

type Props = { order: QueueOrder; storeName: string; storeSlug: string; timezone: string; autoPrintOnAccept: boolean };

export function OrderCard({ order, storeName, storeSlug, timezone, autoPrintOnAccept }: Props) {
  const orderLabel = formatOrderNumber(order.number);
  const next = nextStatus(order.fulfillment, order.status);
  const label = advanceLabel(order.fulfillment, order.status);
  const trackingUrl = new URL(`/${storeSlug}/pedido/${order.publicToken}`, appUrl()).toString();
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

  const TypeIcon = FULFILLMENT_ICONS[order.fulfillment];
  const actionButton = "size-[38px] shrink-0";

  return (
    <article aria-label={`Pedido ${orderLabel}`} className="flex flex-col gap-2.5 rounded-xl border border-border bg-card p-3 text-card-foreground">
      <div className="flex items-center gap-2">
        <b className="text-lg">{orderLabel}</b>
        <span className={cn("rounded-full border border-transparent px-2 py-0.5 text-xs font-semibold", STATUS_BADGE[order.status])}>
          {queueStatusLabel(order.status, order.fulfillment)}
        </span>
        <OrderTime createdAt={String(order.createdAt)} timezone={timezone} />
      </div>
      <div className="flex items-center gap-2">
        <span title={FULFILLMENT_LABELS[order.fulfillment]} className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[13px]">
          <TypeIcon className="size-3.5" aria-hidden="true" />
          {PANEL_FULFILLMENT_LABELS[order.fulfillment]}
        </span>
        <span className="font-medium">{order.customerName}</span>
        <a
          href={`tel:${order.customerPhone}`}
          aria-label={`Ligar para ${order.customerName}`}
          title={order.customerPhone}
          className="ml-auto grid size-7 place-items-center rounded-lg hover:bg-muted"
        >
          <PhoneIcon className="size-4" aria-hidden="true" />
        </a>
      </div>
      {order.address && (
        <span className="flex items-start gap-1.5 text-[13px] text-muted-foreground">
          <MapPinIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          {formatOrderAddress(order.address)}
        </span>
      )}
      {order.tableLabel && <p className="text-[13px]">Mesa {order.tableLabel}</p>}
      <ul className="flex flex-col gap-1 border-y border-dashed border-border py-2 text-[13px]">
        {order.items.map((item, index) => (
          <li key={index}>
            {item.quantity}× {item.description}
            {item.options.map((option) => (
              <span key={option} className="block pl-4 text-muted-foreground">
                + {option}
              </span>
            ))}
            {item.notes && <span className="block pl-4 italic">Obs.: {item.notes}</span>}
          </li>
        ))}
      </ul>
      {order.notes && <p className="text-[13px] italic">Obs. do pedido: {order.notes}</p>}
      <div className="flex items-baseline gap-1.5">
        <span className="flex items-center gap-1 text-[13px] text-muted-foreground">
          <BanknoteIcon className="size-3.5" aria-hidden="true" />
          {PAYMENT_LABELS[order.paymentMethod]}
          {order.changeForCents ? ` · troco p/ ${formatBRL(order.changeForCents)}` : ""}
          {changeCents !== null && changeCents > 0 ? ` (levar ${formatBRL(changeCents)})` : ""}
        </span>
        <b className="ml-auto text-[17px] tabular-nums">{formatBRL(order.totalCents)}</b>
      </div>
      {order.status === "cancelled" && order.cancelReason && <p className="text-[13px] text-[#B42318]">Motivo: {order.cancelReason}</p>}
      <div className="flex items-center gap-1.5">
        {next && label && (
          <AdvanceButton
            orderId={order.id}
            to={next}
            label={label}
            orderLabel={orderLabel}
            printUrl={autoPrintOnAccept && order.status === "received" ? `/painel/pedidos/${order.id}/imprimir` : undefined}
          />
        )}
        <Button variant="outline" size="icon" asChild className={actionButton}>
          <a href={`/painel/pedidos/${order.id}/imprimir`} target="_blank" rel="noreferrer" aria-label={`Imprimir comanda ${orderLabel}`} title="Imprimir comanda">
            <PrinterIcon />
          </a>
        </Button>
        <Button variant="outline" size="icon" asChild className={actionButton}>
          <a href={notifyUrl} target="_blank" rel="noreferrer" aria-label={`Avisar cliente ${orderLabel} no WhatsApp`} title="Avisar no WhatsApp">
            <MessageCircleIcon />
          </a>
        </Button>
        {!isFinalStatus(order.status) && <CancelForm orderId={order.id} orderLabel={orderLabel} />}
      </div>
    </article>
  );
}
