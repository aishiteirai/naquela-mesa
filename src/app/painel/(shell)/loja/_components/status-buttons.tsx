import { Button } from "@/components/ui/button";
import type { ManualStatus } from "@/modules/stores";
import { setManualStatusAction } from "@/app/painel/(shell)/loja/actions";

const OPTIONS: { value: ManualStatus; label: string }[] = [
  { value: "auto", label: "Automático" },
  { value: "force_open", label: "Abrir agora" },
  { value: "force_closed", label: "Fechar agora" },
];

/** Botões segmentados; `aria-pressed` marca o status atual. */
export function StatusButtons({ current }: { current: ManualStatus }) {
  return (
    <form action={setManualStatusAction} role="group" aria-label="Status da loja" className="inline-flex w-fit flex-wrap rounded-lg border p-1">
      {OPTIONS.map((option) => (
        <Button
          key={option.value}
          type="submit"
          name="status"
          value={option.value}
          aria-pressed={current === option.value}
          variant={current === option.value ? "default" : "ghost"}
        >
          {option.label}
        </Button>
      ))}
    </form>
  );
}
