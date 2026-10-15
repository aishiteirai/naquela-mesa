import {
  advanceLabel,
  FULFILLMENT_LABELS,
  formatOrderAddress,
  formatOrderNumber,
  isFinalStatus,
  nextStatus,
  PAYMENT_LABELS,
  statusLabel,
  type QueueOrder,
} from "@/modules/orders";
import { MessageCircleIcon, PrinterIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { buildStatusMessage, waMeLink } from "@/modules/whatsapp";
import { appUrl } from "@/shared/env";
import { formatBRL } from "@/shared/money";
import { AdvanceButton } from "./advance-button";
import { CancelForm } from "./cancel-form";

type Props = { order: QueueOrder; storeName: string; storeSlug: string; timezone: string; autoPrintOnAccept: boolean };

export function OrderCard({ order, storeName, storeSlug, timezone, autoPrintOnAccept }: Props) {
  const orderLabel = formatOrderNumber(order.number);
  const time = new Intl.DateTimeFormat("pt-BR", { timeZone: timezone, hour: "2-digit", minute: "2-digit" }).format(new Date(order.createdAt));
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

  return (
    <article aria-label={`Pedido ${orderLabel}`}>
      <Card size="sm" className="gap-3 text-sm">
        <CardHeader>
          <CardTitle className="text-base font-bold">{orderLabel}</CardTitle>
          <CardAction className="text-muted-foreground tabular-nums">{time}</CardAction>
          <div className="flex flex-wrap gap-1.5">
            <Badge variant={order.status === "cancelled" ? "destructive" : "default"}>{statusLabel(order.status, order.fulfillment)}</Badge>
            <Badge variant="outline">{FULFILLMENT_LABELS[order.fulfillment]}</Badge>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <p>
            {order.customerName} ·{" "}
            <a href={`tel:${order.customerPhone}`} className="underline underline-offset-4">
              {order.customerPhone}
            </a>
          </p>
          {order.address && <p className="text-muted-foreground">{formatOrderAddress(order.address)}</p>}
          {order.tableLabel && <p>Mesa {order.tableLabel}</p>}
          <ul className="flex flex-col gap-1 border-y py-2">
            {order.items.map((item, index) => (
              <li key={index}>
                <span className="font-medium">
                  {item.quantity}x {item.description}
                </span>
                {item.options.map((option) => (
                  <span key={option} className="block pl-3 text-muted-foreground">
                    + {option}
                  </span>
                ))}
                {item.notes && <span className="block pl-3 italic">Obs.: {item.notes}</span>}
              </li>
            ))}
          </ul>
          {order.notes && <p className="italic">Obs. do pedido: {order.notes}</p>}
          <p className="text-muted-foreground">
            {PAYMENT_LABELS[order.paymentMethod]}
            {order.changeForCents ? ` · troco para ${formatBRL(order.changeForCents)}` : ""}
            {changeCents !== null && changeCents > 0 ? ` (levar ${formatBRL(changeCents)})` : ""}
          </p>
          <p className="font-semibold tabular-nums">Total {formatBRL(order.totalCents)}</p>
          {order.status === "cancelled" && order.cancelReason && <p className="text-destructive">Motivo: {order.cancelReason}</p>}
        </CardContent>
        <CardFooter className="flex flex-wrap items-center gap-2">
          {next && label && (
            <AdvanceButton
              orderId={order.id}
              to={next}
              label={label}
              orderLabel={orderLabel}
              printUrl={autoPrintOnAccept && order.status === "received" ? `/painel/pedidos/${order.id}/imprimir` : undefined}
            />
          )}
          <Button variant="outline" size="icon" asChild>
            <a href={`/painel/pedidos/${order.id}/imprimir`} target="_blank" rel="noreferrer" aria-label={`Imprimir comanda ${orderLabel}`} title="Imprimir comanda">
              <PrinterIcon />
            </a>
          </Button>
          {/* Verde do WhatsApp: a cor que o dono reconhece. */}
          <Button size="icon" asChild className="bg-green-700 text-white hover:bg-green-800">
            <a href={notifyUrl} target="_blank" rel="noreferrer" aria-label={`Avisar cliente ${orderLabel}`} title="Avisar cliente no WhatsApp">
              <MessageCircleIcon />
            </a>
          </Button>
          {!isFinalStatus(order.status) && <CancelForm orderId={order.id} orderLabel={orderLabel} />}
        </CardFooter>
      </Card>
    </article>
  );
}
