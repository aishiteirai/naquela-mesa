"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { EllipsisIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { idleState, withConnectionError, type ActionState } from "@/app/_lib/action-state";
import { ActionForm } from "@/app/_components/action-form";
import { TextField } from "@/app/_components/form-fields";
import { cancelOrderAction } from "@/app/painel/(shell)/pedidos/actions";
import { useQueueNotice } from "./queue-notice";

const safeCancel = withConnectionError(cancelOrderAction);

/** Menu "⋯" do card; "Cancelar pedido" abre o diálogo com o motivo. */
export function CancelForm({ orderId, orderLabel }: { orderId: string; orderLabel: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(async (prev: ActionState, form: FormData) => {
    const next = await safeCancel(prev, form);
    // Sucesso, ou erro sem campo (pedido já mudou em outro aparelho): fecha o diálogo; o aviso vai para a fila.
    if (next.status === "success" || (next.status === "error" && Object.keys(next.fieldErrors).length === 0)) setOpen(false);
    return next;
  }, idleState);
  const router = useRouter();
  const notice = useQueueNotice();

  useEffect(() => {
    if (state.status === "success") {
      notice(`Pedido ${orderLabel} cancelado.`);
      router.refresh();
    } else if (state.status === "error" && Object.keys(state.fieldErrors).length === 0) {
      notice(state.message);
      router.refresh();
    }
  }, [state, router, notice, orderLabel]);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="ghost" size="icon-lg" aria-label={`Mais ações do pedido ${orderLabel}`} title="Mais (cancelar)" className="text-muted-foreground">
            <EllipsisIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem variant="destructive" onSelect={() => setOpen(true)}>
            Cancelar pedido
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar pedido {orderLabel}</DialogTitle>
            <DialogDescription>O cliente verá o motivo no acompanhamento do pedido.</DialogDescription>
          </DialogHeader>
          <ActionForm action={formAction} pending={pending} className="flex flex-col gap-3">
            <input type="hidden" name="orderId" value={orderId} />
            <TextField label="Motivo do cancelamento" name="cancelReason" state={state} maxLength={200} autoFocus />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Voltar
              </Button>
              <Button type="submit" variant="destructive" disabled={pending}>
                Confirmar cancelamento
              </Button>
            </div>
          </ActionForm>
        </DialogContent>
      </Dialog>
    </>
  );
}
