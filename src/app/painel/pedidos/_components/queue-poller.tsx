"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createAlertSound } from "./alert-sound";

const BASE_INTERVAL = 5_000;
const MAX_INTERVAL = 30_000;
const BASE_TITLE = "Painel | Naquela Mesa";

export function QueuePoller({ initialVersion, initialReceived }: { initialVersion: string; initialReceived: number }) {
  const router = useRouter();
  const [started, setStarted] = useState(false);
  const [offline, setOffline] = useState(false);
  const [alerting, setAlerting] = useState(false);
  const sound = useRef(createAlertSound());
  const version = useRef(initialVersion);
  const received = useRef(initialReceived);
  const startedRef = useRef(false);

  useEffect(() => {
    let delay = BASE_INTERVAL;
    let timer: number;
    let cancelled = false;

    async function tick() {
      if (document.visibilityState === "visible") {
        try {
          const response = await fetch("/api/painel/pedidos/versao", { cache: "no-store" });
          if (!response.ok) throw new Error(String(response.status));
          const data = (await response.json()) as { version: string; received: number };
          setOffline(false);
          delay = BASE_INTERVAL;
          if (data.version !== version.current) {
            version.current = data.version;
            router.refresh();
          }
          if (data.received > received.current) {
            document.title = `(${data.received}) Novo pedido — Painel`;
            setAlerting(true);
            if (startedRef.current) sound.current.start();
            if ("Notification" in window && Notification.permission === "granted") {
              new Notification("Novo pedido", { body: "Abra o painel para aceitar." });
            }
          } else if (data.received === 0) {
            sound.current.stop();
            setAlerting(false);
            document.title = BASE_TITLE;
          }
          received.current = data.received;
        } catch {
          setOffline(true);
          delay = Math.min(delay * 2, MAX_INTERVAL);
        }
      }
      if (!cancelled) timer = window.setTimeout(tick, delay);
    }

    timer = window.setTimeout(tick, delay);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [router]);

  useEffect(() => {
    if (!alerting) return;
    function stopAlert() {
      sound.current.stop();
      setAlerting(false);
      document.title = BASE_TITLE;
    }
    document.addEventListener("pointerdown", stopAlert, { once: true });
    return () => document.removeEventListener("pointerdown", stopAlert);
  }, [alerting]);

  async function start() {
    sound.current.unlock();
    startedRef.current = true;
    setStarted(true);
    try {
      await navigator.wakeLock?.request("screen");
    } catch {
      // Wake Lock é opcional (nem todo navegador oferece).
    }
    if ("Notification" in window && Notification.permission === "default") {
      void Notification.requestPermission();
    }
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
