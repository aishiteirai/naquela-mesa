"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import type { ManualStatus } from "@/modules/stores";
import { runPanelAction } from "@/app/painel/_components/run-panel-action";
import { setManualStatusAction } from "@/app/painel/(shell)/loja/actions";

const OPTIONS: { value: ManualStatus; label: string }[] = [
  { value: "auto", label: "Automático" },
  { value: "force_open", label: "Abrir agora" },
  { value: "force_closed", label: "Fechar agora" },
];

/** Botões segmentados; `aria-pressed` marca o status atual. */
export function StatusButtons({ current }: { current: ManualStatus }) {
  const [pending, startTransition] = useTransition();

  function choose(status: ManualStatus) {
    const form = new FormData();
    form.set("status", status);
    startTransition(async () => {
      await runPanelAction(() => setManualStatusAction(form));
    });
  }

  return (
    <div role="group" aria-label="Status da loja" aria-busy={pending || undefined} className="inline-flex w-fit flex-wrap rounded-lg border p-1">
      {OPTIONS.map((option) => (
        <Button
          key={option.value}
          type="button"
          aria-pressed={current === option.value}
          variant={current === option.value ? "default" : "ghost"}
          disabled={pending}
          onClick={() => choose(option.value)}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}
