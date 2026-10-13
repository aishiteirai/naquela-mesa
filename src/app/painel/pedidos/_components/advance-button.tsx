"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";
import type { OrderStatus } from "@/modules/orders/client";
import { idleState } from "@/app/_lib/action-state";
import { advanceOrderAction } from "@/app/painel/pedidos/actions";
import { useQueueNotice } from "./queue-notice";

export function AdvanceButton({ orderId, to, label, orderLabel, printUrl }: { orderId: string; to: OrderStatus; label: string; orderLabel: string; printUrl?: string }) {
  const [state, formAction, pending] = useActionState(advanceOrderAction, idleState);
  const router = useRouter();
  const notice = useQueueNotice();

  useEffect(() => {
    if (state.status === "idle") return;
    if (state.status === "error") notice(state.message);
    router.refresh();
  }, [state, router, notice]);

  return (
    <form
      action={formAction}
      onSubmit={() => {
        // Abre a comanda no clique (gesto do usuário), para o navegador não bloquear a janela.
        if (printUrl) window.open(printUrl, "_blank");
      }}
    >
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="to" value={to} />
      <button
        type="submit"
        disabled={pending}
        aria-label={`${label} ${orderLabel}`}
        className="rounded bg-neutral-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
      >
        {label}
      </button>
    </form>
  );
}
