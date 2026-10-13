import type { ManualStatus } from "@/modules/stores";
import { setManualStatusAction } from "@/app/painel/loja/actions";

const OPTIONS: { value: ManualStatus; label: string }[] = [
  { value: "auto", label: "Automático" },
  { value: "force_open", label: "Abrir agora" },
  { value: "force_closed", label: "Fechar agora" },
];

export function StatusButtons({ current }: { current: ManualStatus }) {
  return (
    <form action={setManualStatusAction} className="flex flex-wrap gap-2">
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="submit"
          name="status"
          value={option.value}
          aria-pressed={current === option.value}
          className={
            current === option.value
              ? "rounded bg-neutral-900 px-4 py-2 text-sm font-semibold text-white dark:bg-neutral-100 dark:text-neutral-900"
              : "rounded border border-neutral-300 px-4 py-2 text-sm dark:border-neutral-700"
          }
        >
          {option.label}
        </button>
      ))}
    </form>
  );
}
