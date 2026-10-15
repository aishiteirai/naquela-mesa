"use client";

import { PrinterIcon } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  formatOrderAddress,
  formatOrderNumber,
  FULFILLMENT_LABELS,
  PAYMENT_LABELS,
  statusLabel,
} from "@/modules/orders/client";
import type { QueueOrder } from "@/modules/orders";
import { formatBRL } from "@/shared/money";

export type HistoryRow = { order: QueueOrder; when: string };

function StatusBadge({ order }: { order: QueueOrder }) {
  return (
    <Badge variant={order.status === "cancelled" ? "destructive" : "secondary"}>{statusLabel(order.status, order.fulfillment)}</Badge>
  );
}

function OrderDetail({ order }: { order: QueueOrder }) {
  const orderLabel = formatOrderNumber(order.number);
  return (
    <div className="flex flex-col gap-3 text-sm">
      <div className="flex flex-wrap gap-1.5">
        <StatusBadge order={order} />
        <Badge variant="outline">{FULFILLMENT_LABELS[order.fulfillment]}</Badge>
      </div>
      <div className="flex flex-col gap-1">
        <p className="font-medium">{order.customerName}</p>
        <a href={`tel:${order.customerPhone}`} className="w-fit underline underline-offset-4">
          {order.customerPhone}
        </a>
        {order.address && <p className="text-muted-foreground">{formatOrderAddress(order.address)}</p>}
        {order.tableLabel && <p>Mesa {order.tableLabel}</p>}
      </div>
      <ul className="flex flex-col gap-1 border-y py-2">
        {order.items.map((item, index) => (
          <li key={index}>
            <span className="flex justify-between gap-2">
              <span className="font-medium">
                {item.quantity}x {item.description}
              </span>
              <span className="tabular-nums">{formatBRL(item.totalCents)}</span>
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
      </p>
      <p className="tabular-nums">
        Subtotal {formatBRL(order.subtotalCents)} · Entrega {formatBRL(order.deliveryFeeCents)} ·{" "}
        <span className="font-semibold">Total {formatBRL(order.totalCents)}</span>
      </p>
      {order.status === "cancelled" && order.cancelReason && <p className="text-destructive">Motivo: {order.cancelReason}</p>}
      <Button variant="outline" asChild className="self-start">
        <a href={`/painel/pedidos/${order.id}/imprimir`} target="_blank" rel="noreferrer" aria-label={`Imprimir comanda ${orderLabel}`}>
          <PrinterIcon />
          Imprimir comanda
        </a>
      </Button>
    </div>
  );
}

/** Tabela no desktop, cartões no celular; o detalhe abre num painel lateral. */
export function HistoryList({ rows }: { rows: HistoryRow[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const open = rows.find((row) => row.order.id === openId);

  return (
    <>
      <div className="hidden overflow-hidden rounded-lg border md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Pedido</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(({ order, when }) => {
              const orderLabel = formatOrderNumber(order.number);
              return (
                <TableRow key={order.id} className="relative cursor-pointer" onClick={() => setOpenId(order.id)}>
                  <TableCell>
                    <button
                      type="button"
                      onClick={() => setOpenId(order.id)}
                      aria-label={`Ver pedido ${orderLabel}`}
                      className="font-bold outline-none after:absolute after:inset-0 focus-visible:underline"
                    >
                      {orderLabel}
                    </button>
                  </TableCell>
                  <TableCell className="text-muted-foreground tabular-nums">{when}</TableCell>
                  <TableCell className="max-w-48 truncate">{order.customerName}</TableCell>
                  <TableCell>{FULFILLMENT_LABELS[order.fulfillment]}</TableCell>
                  <TableCell>
                    <StatusBadge order={order} />
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{formatBRL(order.totalCents)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <ul className="flex flex-col gap-2 md:hidden">
        {rows.map(({ order, when }) => {
          const orderLabel = formatOrderNumber(order.number);
          return (
            <li key={order.id}>
              <button
                type="button"
                onClick={() => setOpenId(order.id)}
                aria-label={`Ver pedido ${orderLabel}`}
                className="flex w-full flex-col gap-1 rounded-lg border p-3 text-left text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="font-bold">{orderLabel}</span>
                  <span className="font-medium tabular-nums">{formatBRL(order.totalCents)}</span>
                </span>
                <span className="text-muted-foreground">
                  {when} · {order.customerName} · {FULFILLMENT_LABELS[order.fulfillment]}
                </span>
                <span>
                  <StatusBadge order={order} />
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <Sheet open={open !== undefined} onOpenChange={(value) => !value && setOpenId(null)}>
        {open && (
          <SheetContent side="right" className="w-full gap-0 overflow-y-auto data-[side=right]:w-full data-[side=right]:sm:max-w-md">
            <SheetHeader className="border-b">
              <SheetTitle>Pedido {formatOrderNumber(open.order.number)}</SheetTitle>
              <SheetDescription>{open.when}</SheetDescription>
            </SheetHeader>
            <div className="p-4">
              <OrderDetail order={open.order} />
            </div>
          </SheetContent>
        )}
      </Sheet>
    </>
  );
}
