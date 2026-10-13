import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { describeLine, FULFILLMENT_LABELS, formatOrderNumber, getStoreOrder, PAYMENT_LABELS } from "@/modules/orders";
import { isDomainError } from "@/shared/errors";
import { formatBRL } from "@/shared/money";
import { requireStoreAccess } from "@/app/painel/_lib/access";
import { PrintOnLoad } from "./_components/print-on-load";

async function Ticket({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { store } = await requireStoreAccess();

  let order;
  try {
    order = await getStoreOrder(store.id, id);
  } catch (error) {
    if (isDomainError(error) && error.code === "NOT_FOUND") notFound();
    throw error;
  }

  const when = new Intl.DateTimeFormat("pt-BR", { timeZone: store.timezone, dateStyle: "short", timeStyle: "short" }).format(new Date(order.createdAt));
  const change = order.changeForCents ? order.changeForCents - order.totalCents : 0;

  return (
    <div className="mx-auto w-[74mm] font-mono text-[12px] leading-snug text-black">
      <title>{`Comanda ${formatOrderNumber(order.number)}`}</title>
      <style>{"@page { size: 80mm auto; margin: 3mm } @media print { body { background: #fff } }"}</style>
      <PrintOnLoad />
      <p className="text-center font-bold">{store.name}</p>
      <p className="text-center text-[16px] font-bold">Pedido {formatOrderNumber(order.number)}</p>
      <p className="text-center">{when}</p>
      {order.status === "cancelled" && <p className="text-center font-bold">CANCELADO — {order.cancelReason}</p>}
      <hr className="my-1 border-dashed border-black" />
      <p className="font-bold">{FULFILLMENT_LABELS[order.fulfillment]}</p>
      <p>
        {order.customerName} · {order.customerPhone}
      </p>
      {order.address && (
        <>
          <p>
            {order.address.street}, {order.address.number}
            {order.address.complement ? ` - ${order.address.complement}` : ""}
          </p>
          <p>{order.address.neighborhood}</p>
          {order.address.reference && <p>Ref.: {order.address.reference}</p>}
        </>
      )}
      {order.tableLabel && <p>Mesa {order.tableLabel}</p>}
      <hr className="my-1 border-dashed border-black" />
      {order.lines.map((line, index) => (
        <div key={index} className="mb-1">
          <div className="flex justify-between gap-2">
            <span>
              {line.quantity}x {describeLine(line)}
            </span>
            <span>{formatBRL(line.totalCents)}</span>
          </div>
          {line.options.map((option) => (
            <p key={option.optionName} className="pl-2">
              + {option.groupName}: {option.optionName}
            </p>
          ))}
          {line.notes && <p className="pl-2">Obs.: {line.notes}</p>}
        </div>
      ))}
      <hr className="my-1 border-dashed border-black" />
      <div className="flex justify-between">
        <span>Subtotal</span>
        <span>{formatBRL(order.subtotalCents)}</span>
      </div>
      {order.fulfillment === "delivery" && (
        <div className="flex justify-between">
          <span>Entrega</span>
          <span>{formatBRL(order.deliveryFeeCents)}</span>
        </div>
      )}
      <div className="flex justify-between font-bold">
        <span>Total</span>
        <span>{formatBRL(order.totalCents)}</span>
      </div>
      <p>
        Pagamento: {PAYMENT_LABELS[order.paymentMethod]}
        {order.changeForCents ? ` · troco para ${formatBRL(order.changeForCents)}` : ""}
      </p>
      {change > 0 && <p className="font-bold">Levar troco: {formatBRL(change)}</p>}
      {order.notes && <p>Obs. do pedido: {order.notes}</p>}
    </div>
  );
}

export default function PrintPage({ params }: PageProps<"/painel/pedidos/[id]/imprimir">) {
  return (
    <Suspense fallback={<p>Carregando comanda...</p>}>
      <Ticket params={params} />
    </Suspense>
  );
}
