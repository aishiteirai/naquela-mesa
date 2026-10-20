"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BellRingIcon, WifiOffIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useNewOrders } from "./new-orders-context";

function waitingText(count: number): string {
  if (count === 1) return "1 pedido novo aguardando";
  if (count > 1) return `${count} pedidos novos aguardando`;
  return "Pedido novo";
}

/** Aviso de conexão e de pedido novo no topo de qualquer página do painel. */
export function OrderAlertBar() {
  const { count, offline, alerting, silence } = useNewOrders();
  const onQueue = usePathname() === "/painel";
  if (!offline && !alerting) return null;

  return (
    <div className="mb-4 flex flex-col gap-2">
      {offline && (
        <Alert variant="destructive" role="status">
          <WifiOffIcon />
          <AlertTitle>Sem conexão — tentando reconectar</AlertTitle>
        </Alert>
      )}
      {alerting && (
        <Alert role="alert" data-testid="new-order-alert">
          <BellRingIcon />
          <AlertTitle>{waitingText(count)}</AlertTitle>
          <AlertDescription className="flex flex-wrap gap-2 pt-1">
            {!onQueue && (
              <Button asChild size="sm">
                <Link href="/painel">Ver pedidos</Link>
              </Button>
            )}
            <Button type="button" size="sm" variant="outline" onClick={silence}>
              Silenciar
            </Button>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
