import { secondaryButtonClass } from "@/app/_components/styles";

export function MoveButtons({
  action,
  hidden,
  label,
  isFirst,
  isLast,
}: {
  action: (form: FormData) => Promise<void>;
  hidden: Record<string, string>;
  label: string;
  isFirst: boolean;
  isLast: boolean;
}) {
  return (
    <form action={action} className="flex gap-1">
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <button type="submit" name="direction" value="up" disabled={isFirst} aria-label={`Subir ${label}`} className={secondaryButtonClass}>
        ↑
      </button>
      <button type="submit" name="direction" value="down" disabled={isLast} aria-label={`Descer ${label}`} className={secondaryButtonClass}>
        ↓
      </button>
    </form>
  );
}
