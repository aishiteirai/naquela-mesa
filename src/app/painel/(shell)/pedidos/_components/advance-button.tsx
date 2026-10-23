"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef } from "react";
import type { OrderStatus } from "@/modules/orders/client";
import { ArrowRightIcon, CheckIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { idleState, withConnectionError } from "@/app/_lib/action-state";
import { advanceOrderAction } from "@/app/painel/(shell)/pedidos/actions";
import { useQueueNotice } from "./queue-notice";

const advance = withConnectionError(advanceOrderAction);

export function AdvanceButton({ orderId, to, label, orderLabel, printUrl }: { orderId: string; to: OrderStatus; label: string; orderLabel: string; printUrl?: string }) {
  const [state, formAction, pending] = useActionState(advance, idleState);
  const router = useRouter();
  const notice = useQueueNotice();
  const printWindow = useRef<Window | null>(null);

  useEffect(() => {
    if (state.status === "idle") return;
    // A comanda só ganha endereço depois que a transição deu certo; em erro a aba vazia é fechada.
    const win = printWindow.current;
    printWindow.current = null;
    if (state.status === "success" && win && printUrl) win.location.href = printUrl;
    else win?.close();
    if (state.status === "error") notice(state.message);
    router.refresh();
  }, [state, router, notice, printUrl]);

  return (
    <form
      action={formAction}
      className="flex-1"
      onSubmit={(event) => {
        if (pending || printWindow.current) {
          event.preventDefault();
          return;
        }
        // Abre a aba no clique (gesto do usuário), para o navegador não bloquear a janela.
        if (printUrl) printWindow.current = window.open("", "_blank");
      }}
    >
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="to" value={to} />
      <Button type="submit" size="lg" disabled={pending} aria-label={`${label} ${orderLabel}`} className="w-full font-semibold">
        {to === "preparing" || to === "completed" ? <CheckIcon /> : <ArrowRightIcon />}
        {label}
      </Button>
    </form>
  );
}
