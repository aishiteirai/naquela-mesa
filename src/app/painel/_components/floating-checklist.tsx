"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { CircleCheckIcon, CircleIcon, XIcon } from "lucide-react";
import type { ChecklistItem } from "@/modules/onboarding";
import { CHECKLIST_DISMISS_KEY, shouldShowChecklist } from "@/app/painel/_lib/checklist-visibility";

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// Sem localStorage (ou com erro) conta como "não fechado".
function readDismissed(): string {
  try {
    return window.localStorage.getItem(CHECKLIST_DISMISS_KEY) ?? "";
  } catch {
    return "";
  }
}

function dismiss(sessionId: string) {
  try {
    window.localStorage.setItem(CHECKLIST_DISMISS_KEY, sessionId);
  } catch {
    // Sem storage: o card some só até recarregar.
  }
  listeners.forEach((listener) => listener());
}

export function FloatingChecklist({ sessionId, items }: { sessionId: string; items: ChecklistItem[] }) {
  // null no servidor e na hidratação: o card só monta depois de ler o storage, sem piscar.
  const dismissedFor = useSyncExternalStore<string | null>(subscribe, readDismissed, () => null);
  const done = items.filter((item) => item.done).length;
  const pending = items.length - done;

  if (dismissedFor === null) return null;
  if (!shouldShowChecklist({ sessionId, dismissedFor: dismissedFor || null, pending })) return null;

  return (
    <section
      role="region"
      aria-label="Primeiros passos"
      className="fixed bottom-4 right-4 z-40 flex w-[min(360px,calc(100vw-32px))] flex-col gap-2.5 rounded-[14px] border border-border bg-card p-4 text-card-foreground shadow-[0_12px_32px_rgba(59,42,32,0.16)] sm:bottom-6 sm:right-6"
    >
      <div className="flex items-start gap-2">
        <div className="flex-1">
          <h2 className="text-base font-semibold">Primeiros passos</h2>
          <p className="mt-0.5 text-muted-foreground">
            {done} de {items.length} concluídos
          </p>
        </div>
        <button
          type="button"
          aria-label="Fechar primeiros passos"
          onClick={() => dismiss(sessionId)}
          className="flex size-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent"
        >
          <XIcon aria-hidden="true" className="size-4" />
        </button>
      </div>
      <div aria-hidden="true" className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full bg-primary" style={{ width: `${(done / items.length) * 100}%` }} />
      </div>
      <ul className="mt-0.5 flex flex-col gap-2">
        {items.map((item) => (
          <li key={item.key}>
            {item.done ? (
              <span className="flex items-center gap-2 text-muted-foreground line-through">
                <CircleCheckIcon aria-hidden="true" className="size-4 shrink-0" />
                {item.label}
              </span>
            ) : (
              <Link href={item.href} className="flex items-center gap-2 underline-offset-4 hover:underline">
                <CircleIcon aria-hidden="true" className="size-4 shrink-0" />
                {item.label}
              </Link>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-1 text-xs text-muted-foreground">Fechou? Ele volta no próximo login até tudo ficar pronto.</p>
    </section>
  );
}
