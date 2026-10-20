"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createAlertSound, type AlertSound } from "./alert-sound";

const BASE_INTERVAL = 5_000;
const HIDDEN_INTERVAL = 15_000;
const MAX_INTERVAL = 30_000;
const FETCH_TIMEOUT = 8_000;
const ATTENDING_KEY = "naquela-mesa:atendimento";

type NewOrders = {
  /** Pedidos aguardando aceite (selo da barra lateral). */
  count: number;
  /** Muda a cada pedido novo ou mudança de status; a fila recarrega quando muda. */
  version: string;
  offline: boolean;
  /** "Iniciar atendimento" clicado nesta aba (vale até fechar a aba). */
  attending: boolean;
  /** Pedido novo sem resposta: som (se atendendo) e título piscando. */
  alerting: boolean;
  startAttending: () => void;
  silence: () => void;
};

const NewOrdersCtx = createContext<NewOrders | null>(null);

export function useNewOrders(): NewOrders {
  const ctx = useContext(NewOrdersCtx);
  if (!ctx) throw new Error("useNewOrders precisa estar dentro de NewOrdersProvider");
  return ctx;
}

function readAttending(): boolean {
  try {
    return window.sessionStorage.getItem(ATTENDING_KEY) === "1";
  } catch {
    return false;
  }
}

/** Único observador da fila no painel: polling, contagem, som, título e notificação, em qualquer página. */
export function NewOrdersProvider({
  initialCount,
  initialTotal,
  initialVersion,
  children,
}: {
  initialCount: number;
  initialTotal: number;
  initialVersion: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const [count, setCount] = useState(initialCount);
  const [version, setVersion] = useState(initialVersion);
  const [offline, setOffline] = useState(false);
  const [attending, setAttending] = useState(false);
  const [alerting, setAlerting] = useState(false);
  const total = useRef(initialTotal);
  const waitingOnLoad = useRef(initialCount);
  const sound = useRef<AlertSound | null>(null);
  const attendingRef = useRef(false);
  const wakeLock = useRef<WakeLockSentinel | null>(null);
  const baseTitle = useRef<string | null>(null);

  const getSound = useCallback(() => (sound.current ??= createAlertSound()), []);

  const requestWakeLock = useCallback(async () => {
    try {
      wakeLock.current = (await navigator.wakeLock?.request("screen")) ?? null;
    } catch {
      // Wake Lock é opcional (nem todo navegador oferece).
    }
  }, []);

  // Atendimento iniciado antes de recarregar: o áudio só volta depois de um gesto na página.
  useEffect(() => {
    if (!readAttending()) return;
    attendingRef.current = true;
    /* eslint-disable react-hooks/set-state-in-effect -- sessionStorage só existe no cliente */
    setAttending(true);
    // Pedidos que já esperavam ao recarregar voltam a alertar.
    if (waitingOnLoad.current > 0) setAlerting(true);
    /* eslint-enable react-hooks/set-state-in-effect */
    const unlock = () => {
      getSound().unlock();
      void requestWakeLock();
    };
    document.addEventListener("pointerdown", unlock, { once: true });
    document.addEventListener("keydown", unlock, { once: true });
    return () => {
      document.removeEventListener("pointerdown", unlock);
      document.removeEventListener("keydown", unlock);
    };
  }, [getSound, requestWakeLock]);

  // Polling da versão da fila.
  useEffect(() => {
    let failures = 0;
    let timer: number | undefined;
    let cancelled = false;
    let inFlight = false;

    function nextDelay() {
      const base = document.visibilityState === "visible" ? BASE_INTERVAL : HIDDEN_INTERVAL;
      return Math.min(Math.max(base, BASE_INTERVAL * 2 ** failures), MAX_INTERVAL);
    }

    function notify() {
      try {
        if ("Notification" in window && Notification.permission === "granted") {
          new Notification("Novo pedido", { body: "Abra o painel para aceitar." });
        }
      } catch {
        // Android lança "Illegal constructor"; a notificação é opcional.
      }
    }

    async function tick() {
      if (inFlight || cancelled) return;
      inFlight = true;
      const controller = new AbortController();
      const abortTimer = window.setTimeout(() => controller.abort(), FETCH_TIMEOUT);
      try {
        const response = await fetch("/api/painel/pedidos/versao", { cache: "no-store", signal: controller.signal });
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
        failures = 0;
        setOffline(false);
        const hasNew = data.total > total.current;
        total.current = data.total;
        setCount(data.received);
        setVersion(data.version);
        if (hasNew) {
          setAlerting(true);
          notify();
        } else if (data.received === 0) {
          setAlerting(false);
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
      if (attendingRef.current) void requestWakeLock();
    }

    timer = window.setTimeout(tick, nextDelay());
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [router, requestWakeLock]);

  // Som enquanto houver alerta e o atendimento estiver ativo.
  useEffect(() => {
    if (!alerting || !attending) return;
    const current = getSound();
    current.start();
    return () => current.stop();
  }, [alerting, attending, getSound]);

  // Título "(N) Novo pedido — …" enquanto alerta; o refresh do Next reaplica o título do metadata, então reafirma.
  useEffect(() => {
    if (!alerting) return;
    baseTitle.current ??= document.title;
    const alertTitle = `(${count}) Novo pedido — ${baseTitle.current}`;
    document.title = alertTitle;
    const observer = new MutationObserver(() => {
      if (document.title !== alertTitle) document.title = alertTitle;
    });
    observer.observe(document.head, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [alerting, count]);

  useEffect(() => {
    if (alerting || baseTitle.current === null) return;
    document.title = baseTitle.current;
    baseTitle.current = null;
  }, [alerting]);

  useEffect(
    () => () => {
      sound.current?.stop();
      void wakeLock.current?.release().catch(() => {});
      wakeLock.current = null;
    },
    [],
  );

  const startAttending = useCallback(() => {
    getSound().unlock();
    attendingRef.current = true;
    setAttending(true);
    try {
      window.sessionStorage.setItem(ATTENDING_KEY, "1");
    } catch {
      // modo privado: vale só até recarregar
    }
    if ("Notification" in window && Notification.permission === "default") void Notification.requestPermission();
    void requestWakeLock();
    // Pedidos que já esperavam antes do clique também tocam.
    if (count > 0) setAlerting(true);
  }, [count, getSound, requestWakeLock]);

  const silence = useCallback(() => setAlerting(false), []);

  const value = useMemo(
    () => ({ count, version, offline, attending, alerting, startAttending, silence }),
    [count, version, offline, attending, alerting, startAttending, silence],
  );
  return <NewOrdersCtx.Provider value={value}>{children}</NewOrdersCtx.Provider>;
}
