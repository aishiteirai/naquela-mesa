"use client";

import { useEffect, useState } from "react";
import { ClockIcon } from "lucide-react";
import { minutesAgo } from "@/app/painel/_lib/relative-time";

/** Hora do pedido; o "há N min" só aparece no cliente e se atualiza a cada minuto. */
export function OrderTime({ createdAt, timezone }: { createdAt: string; timezone: string }) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const timer = window.setInterval(tick, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const created = new Date(createdAt);
  const time = new Intl.DateTimeFormat("pt-BR", { timeZone: timezone, hour: "2-digit", minute: "2-digit" }).format(created);

  return (
    <span className="ml-auto flex items-center gap-1 text-[13px] tabular-nums text-muted-foreground">
      <ClockIcon className="size-3.5" aria-hidden="true" />
      {time}
      {now && ` · ${minutesAgo(created, now)}`}
    </span>
  );
}
