"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { BellRingIcon, WifiOffIcon } from "lucide-react";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useNewOrders } from "@/app/painel/_components/new-orders-context";
import { createAlertSound } from "./alert-sound";

const BASE_INTERVAL = 5_000;
const HIDDEN_INTERVAL = 15_000;
const MAX_INTERVAL = 30_000;
const FETCH_TIMEOUT = 8_000;

export function QueuePoller({ initialVersion, initialReceived, initialTotal }: { initialVersion: string; initialReceived: number; initialTotal: number }) {
  const router = useRouter();
  const { setCount, claimPolling } = useNewOrders();
  const [started, setStarted] = useState(false);
  const [offline, setOffline] = useState(false);
  const [alerting, setAlerting] = useState(false);
  const sound = useRef<ReturnType<typeof createAlertSound> | null>(null);
  const getSound = () => (sound.current ??= createAlertSound());
  const version = useRef(initialVersion);
  const received = useRef(initialReceived);
  const total = useRef(initialTotal);
  const baseTitle = useRef("");
  const mounted = useRef(true);
  const startedRef = useRef(false);
  const alertTitle = useRef("");
  const wakeLock = useRef<WakeLockSentinel | null>(null);

  async function requestWakeLock() {
    try {
      wakeLock.current = (await navigator.wakeLock?.request("screen")) ?? null;
    } catch {
      // Wake Lock é opcional (nem todo navegador oferece).
    }
  }

  // O selo da barra lateral usa as consultas deste componente em vez de fazer outras.
  useEffect(() => claimPolling(), [claimPolling]);
  useEffect(() => setCount(initialReceived), [initialReceived, setCount]);

  useEffect(() => {
    baseTitle.current = document.title;
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    let failures = 0;
    let timer: number | undefined;
    let cancelled = false;
    let inFlight = false;

    function nextDelay() {
      const base = document.visibilityState === "visible" ? BASE_INTERVAL : HIDDEN_INTERVAL;
      return Math.min(Math.max(base, BASE_INTERVAL * 2 ** failures), MAX_INTERVAL);
    }

    async function tick() {
      if (inFlight || cancelled) return;
      inFlight = true;
      const controller = new AbortController();
      const abortTimer = window.setTimeout(() => controller.abort(), FETCH_TIMEOUT);
      try {
        const response = await fetch("/api/painel/pedidos/versao", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (cancelled) return;
        if (response.status === 401 || response.status === 403) {
          // Sessão/loja inválida: a página redireciona para /login. Para de consultar.
          cancelled = true;
          router.refresh();
          return;
        }
        if (!response.ok) throw new Error(String(response.status));
        const data = (await response.json()) as { version: string; received: number; total: number };
        if (cancelled) return;
        setOffline(false);
        failures = 0;
        const versionChanged = data.version !== version.current;
        const hasNew = data.total > total.current;
        version.current = data.version;
        received.current = data.received;
        total.current = data.total;
        setCount(data.received);
        if (versionChanged) {
          try {
            router.refresh();
          } catch {
            // refresh falho não é falta de conexão.
          }
        }
        if (hasNew) {
          alertTitle.current = `(${data.received}) Novo pedido — Painel`;
          document.title = alertTitle.current;
          setAlerting(true);
          if (startedRef.current) {
            try {
              getSound().start();
            } catch {
              // som é opcional; não pode derrubar o polling.
            }
          }
          try {
            if ("Notification" in window && Notification.permission === "granted") {
              new Notification("Novo pedido", { body: "Abra o painel para aceitar." });
            }
          } catch {
            // Android lança "Illegal constructor"; a notificação é opcional.
          }
        } else if (data.received === 0) {
          try {
            getSound().stop();
          } catch {
            // ignore
          }
          setAlerting(false);
          alertTitle.current = baseTitle.current;
          document.title = baseTitle.current;
        }
      } catch {
        if (cancelled) return;
        setOffline(true);
        failures += 1;
      } finally {
        window.clearTimeout(abortTimer);
        inFlight = false;
      }
      if (!cancelled) timer = window.setTimeout(tick, nextDelay());
    }

    function onVisibility() {
      if (document.visibilityState !== "visible") return;
      window.clearTimeout(timer);
      void tick();
      if (startedRef.current) void requestWakeLock();
    }

    timer = window.setTimeout(tick, nextDelay());
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
      sound.current?.stop();
      document.title = baseTitle.current;
      void wakeLock.current?.release().catch(() => {});
      wakeLock.current = null;
    };
  }, [router, setCount]);

  useEffect(() => {
    if (!alerting) return;
    function stopAlert() {
      getSound().stop();
      setAlerting(false);
      alertTitle.current = baseTitle.current;
      document.title = baseTitle.current;
    }
    document.addEventListener("pointerdown", stopAlert, { once: true });
    // router.refresh() reaplica o título do metadata do Next; reafirma o alerta.
    const observer = new MutationObserver(() => {
      if (document.title !== alertTitle.current) document.title = alertTitle.current;
    });
    observer.observe(document.head, { childList: true, subtree: true, characterData: true });
    return () => {
      observer.disconnect();
      document.removeEventListener("pointerdown", stopAlert);
    };
  }, [alerting]);

  async function start() {
    getSound().unlock();
    startedRef.current = true;
    setStarted(true);
    if ("Notification" in window && Notification.permission === "default") {
      void Notification.requestPermission();
    }
    await requestWakeLock();
    if (!mounted.current) {
      void wakeLock.current?.release().catch(() => {});
      wakeLock.current = null;
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {offline && (
        <Alert variant="destructive" role="status">
          <WifiOffIcon />
          <AlertTitle>Sem conexão — tentando reconectar</AlertTitle>
        </Alert>
      )}
      {started ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <span aria-hidden="true" className="size-2 animate-pulse rounded-full bg-primary" />
          Atendimento ativo: alerta sonoro ligado
        </p>
      ) : (
        <Button type="button" size="lg" onClick={start} className="self-start">
          <BellRingIcon />
          Iniciar atendimento
        </Button>
      )}
    </div>
  );
}
