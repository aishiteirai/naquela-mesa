"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createAlertSound } from "./alert-sound";

const BASE_INTERVAL = 5_000;
const HIDDEN_INTERVAL = 15_000;
const MAX_INTERVAL = 30_000;
const FETCH_TIMEOUT = 8_000;
const BASE_TITLE = "Painel | Naquela Mesa";

export function QueuePoller({ initialVersion, initialReceived }: { initialVersion: string; initialReceived: number }) {
  const router = useRouter();
  const [started, setStarted] = useState(false);
  const [offline, setOffline] = useState(false);
  const [alerting, setAlerting] = useState(false);
  const sound = useRef<ReturnType<typeof createAlertSound> | null>(null);
  const getSound = () => (sound.current ??= createAlertSound());
  const version = useRef(initialVersion);
  const received = useRef(initialReceived);
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
      try {
        const response = await fetch("/api/painel/pedidos/versao", {
          cache: "no-store",
          signal: AbortSignal.timeout(FETCH_TIMEOUT),
        });
        if (cancelled) return;
        if (response.status === 401 || response.status === 403) {
          // Sessão/loja inválida: a página redireciona para /login. Para de consultar.
          cancelled = true;
          router.refresh();
          return;
        }
        if (!response.ok) throw new Error(String(response.status));
        const data = (await response.json()) as { version: string; received: number };
        if (cancelled) return;
        setOffline(false);
        failures = 0;
        const versionChanged = data.version !== version.current;
        const hasNew = data.received > received.current;
        version.current = data.version;
        received.current = data.received;
        if (versionChanged) router.refresh();
        if (hasNew) {
          alertTitle.current = `(${data.received}) Novo pedido — Painel`;
          document.title = alertTitle.current;
          setAlerting(true);
          if (startedRef.current) getSound().start();
          try {
            if ("Notification" in window && Notification.permission === "granted") {
              new Notification("Novo pedido", { body: "Abra o painel para aceitar." });
            }
          } catch {
            // Android lança "Illegal constructor"; a notificação é opcional.
          }
        } else if (data.received === 0) {
          getSound().stop();
          setAlerting(false);
          document.title = BASE_TITLE;
        }
      } catch {
        if (cancelled) return;
        setOffline(true);
        failures += 1;
      } finally {
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
      document.title = BASE_TITLE;
      void wakeLock.current?.release().catch(() => {});
      wakeLock.current = null;
    };
  }, [router]);

  useEffect(() => {
    if (!alerting) return;
    function stopAlert() {
      getSound().stop();
      setAlerting(false);
      document.title = BASE_TITLE;
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
  }

  return (
    <div className="flex flex-col gap-2">
      {offline && (
        <p role="status" className="rounded bg-red-100 px-3 py-2 text-sm text-red-900 dark:bg-red-950 dark:text-red-100">
          Sem conexão — tentando reconectar
        </p>
      )}
      {started ? (
        <p className="text-sm text-green-800 dark:text-green-300">Atendimento ativo: alerta sonoro ligado</p>
      ) : (
        <button type="button" onClick={start} className="self-start rounded bg-green-700 px-4 py-2 text-sm font-semibold text-white">
          Iniciar atendimento
        </button>
      )}
    </div>
  );
}
