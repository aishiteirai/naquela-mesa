"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { idleState } from "@/app/_lib/action-state";
import { TextField } from "@/app/painel/_components/form-fields";
import { cancelOrderAction } from "@/app/painel/(shell)/pedidos/actions";
import { useQueueNotice } from "./queue-notice";

export function CancelForm({ orderId, orderLabel }: { orderId: string; orderLabel: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(cancelOrderAction, idleState);
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

  if (!open) {
    return (
      <Button type="button" variant="ghost" onClick={() => setOpen(true)} aria-label={`Cancelar pedido ${orderLabel}`} className="text-destructive">
        Cancelar
      </Button>
    );
  }

  return (
    <form action={formAction} className="flex w-full flex-col gap-2 rounded-lg border border-destructive/40 p-3">
      <input type="hidden" name="orderId" value={orderId} />
      <TextField label="Motivo do cancelamento" name="cancelReason" state={state} maxLength={200} autoFocus />
      <div className="flex gap-2">
        <Button type="submit" variant="destructive" disabled={pending}>
          Confirmar cancelamento
        </Button>
        <Button type="button" variant="outline" onClick={() => setOpen(false)}>
          Voltar
        </Button>
      </div>
    </form>
  );
}
