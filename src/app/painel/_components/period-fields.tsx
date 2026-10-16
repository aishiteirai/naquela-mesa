import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PERIOD_LABELS, PERIOD_PRESETS, type PeriodPreset } from "@/modules/orders";
import { NativeSelect } from "@/app/_components/native-select";

type Props = { preset: PeriodPreset; from: string; to: string };

/** Campos de período para formulários GET (`periodo`, `de`, `ate`). Uma vez por página (ids fixos). */
export function PeriodFields({ preset, from, to }: Props) {
  return (
    <>
      <Field className="w-auto">
        <FieldLabel htmlFor="filtro-periodo">Período</FieldLabel>
        <NativeSelect id="filtro-periodo" name="periodo" defaultValue={preset}>
          {PERIOD_PRESETS.map((value) => (
            <option key={value} value={value}>
              {PERIOD_LABELS[value]}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field className="w-auto">
        <FieldLabel htmlFor="filtro-de">De</FieldLabel>
        <Input id="filtro-de" type="date" name="de" defaultValue={from} />
      </Field>
      <Field className="w-auto">
        <FieldLabel htmlFor="filtro-ate">Até</FieldLabel>
        <Input id="filtro-ate" type="date" name="ate" defaultValue={to} />
      </Field>
    </>
  );
}
