"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { BellRingIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNewOrders } from "@/app/painel/_components/new-orders-context";

/** Botão "Iniciar atendimento" e recarga da fila quando a versão muda. */
export function QueueControls() {
  const router = useRouter();
  const { version, attending, startAttending } = useNewOrders();
  const shown = useRef(version);

  useEffect(() => {
    if (version === shown.current) return;
    shown.current = version;
    router.refresh();
  }, [version, router]);

  return attending ? (
    <p className="flex items-center gap-2 text-sm text-muted-foreground">
      <span aria-hidden="true" className="size-2 animate-pulse rounded-full bg-primary" />
      Atendimento ativo: alerta sonoro ligado
    </p>
  ) : (
    <Button type="button" onClick={startAttending} className="self-start">
      <BellRingIcon />
      Iniciar atendimento
    </Button>
  );
}
