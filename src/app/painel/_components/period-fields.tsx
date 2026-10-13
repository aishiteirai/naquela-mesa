import { PERIOD_LABELS, PERIOD_PRESETS, type PeriodPreset } from "@/modules/orders";
import { inputClass } from "@/app/_components/styles";

type Props = { preset: PeriodPreset; from: string; to: string };

/** Campos de período para formulários GET (`periodo`, `de`, `ate`). */
export function PeriodFields({ preset, from, to }: Props) {
  return (
    <>
      <label className="flex flex-col gap-1 text-sm">
        Período
        <select name="periodo" defaultValue={preset} className={inputClass}>
          {PERIOD_PRESETS.map((value) => (
            <option key={value} value={value}>
              {PERIOD_LABELS[value]}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        De
        <input type="date" name="de" defaultValue={from} className={inputClass} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Até
        <input type="date" name="ate" defaultValue={to} className={inputClass} />
      </label>
    </>
  );
}
