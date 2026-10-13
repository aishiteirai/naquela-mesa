"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { FieldError } from "@/app/_components/form-controls";
import { inputClass, secondaryButtonClass } from "@/app/_components/styles";
import { idleState } from "@/app/_lib/action-state";
import { cancelOrderAction } from "@/app/painel/pedidos/actions";
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
      <button type="button" onClick={() => setOpen(true)} aria-label={`Cancelar pedido ${orderLabel}`} className={secondaryButtonClass}>
        Cancelar
      </button>
    );
  }

  return (
    <form action={formAction} className="flex w-full flex-col gap-2">
      <input type="hidden" name="orderId" value={orderId} />
      <label className="flex flex-col gap-1 text-sm">
        Motivo do cancelamento
        <input name="cancelReason" maxLength={200} className={inputClass} />
      </label>
      <FieldError state={state} name="cancelReason" />
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className="rounded bg-red-700 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50">
          Confirmar cancelamento
        </button>
        <button type="button" onClick={() => setOpen(false)} className={secondaryButtonClass}>
          Voltar
        </button>
      </div>
    </form>
  );
}
