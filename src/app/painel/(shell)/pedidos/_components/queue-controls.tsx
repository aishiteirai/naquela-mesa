"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { BellRingIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNewOrders } from "@/app/painel/_components/new-orders-context";

/** Botão "Iniciar atendimento" e recarga da fila quando a versão muda. */
export function QueueControls({ renderedVersion }: { renderedVersion: string }) {
  const router = useRouter();
  const { version, attending, soundReady, startAttending } = useNewOrders();
  const shown = useRef(renderedVersion);

  useEffect(() => {
    if (version === shown.current) return;
    shown.current = version;
    router.refresh();
  }, [version, router]);

  return attending ? (
    <p className="flex items-center gap-2 text-sm text-muted-foreground">
      <span aria-hidden="true" className="size-2 animate-pulse rounded-full bg-primary" />
      {soundReady ? "Atendimento ativo: alerta sonoro ligado" : "Atendimento ativo: toque na tela para reativar o som"}
    </p>
  ) : (
    <Button type="button" onClick={startAttending} className="self-start">
      <BellRingIcon />
      Iniciar atendimento
    </Button>
  );
}
