"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

const POLL_INTERVAL = 15_000;

type NewOrdersContext = {
  count: number;
  setCount: (count: number) => void;
  /** O `QueuePoller` chama ao montar: enquanto ele existir, o provider não consulta por conta própria. */
  claimPolling: () => () => void;
};

const NewOrdersCtx = createContext<NewOrdersContext | null>(null);

export function useNewOrders(): NewOrdersContext {
  const ctx = useContext(NewOrdersCtx);
  if (!ctx) throw new Error("useNewOrders precisa estar dentro de NewOrdersProvider");
  return ctx;
}

/** Contagem de pedidos recebidos para o selo da barra lateral; valor inicial vem do servidor. */
export function NewOrdersProvider({ initialCount, children }: { initialCount: number; children: ReactNode }) {
  const [count, setCount] = useState(initialCount);
  const [pollers, setPollers] = useState(0);

  const claimPolling = useCallback(() => {
    setPollers((n) => n + 1);
    return () => setPollers((n) => n - 1);
  }, []);

  useEffect(() => {
    if (pollers > 0) return;
    let cancelled = false;
    let inFlight = false;

    async function check() {
      if (inFlight || cancelled || document.visibilityState !== "visible") return;
      inFlight = true;
      try {
        const response = await fetch("/api/painel/pedidos/versao", { cache: "no-store" });
        if (!response.ok) return;
        const data = (await response.json()) as { received: number };
        if (!cancelled) setCount(data.received);
      } catch {
        // Sem rede: o selo mantém o último valor.
      } finally {
        inFlight = false;
      }
    }

    const timer = window.setInterval(check, POLL_INTERVAL);
    document.addEventListener("visibilitychange", check);
    window.addEventListener("focus", check);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("focus", check);
    };
  }, [pollers]);

  const value = useMemo(() => ({ count, setCount, claimPolling }), [count, claimPolling]);
  return <NewOrdersCtx.Provider value={value}>{children}</NewOrdersCtx.Provider>;
}
