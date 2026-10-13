"use client";

import { uuid } from "@/shared/uuid";
import { useActionState, useState } from "react";
import type { DeliveryZone } from "@/modules/stores";
import { formatCentsForInput } from "@/shared/money";
import { FormMessage, SubmitButton } from "@/app/_components/form-controls";
import { inputClass, secondaryButtonClass } from "@/app/_components/styles";
import { idleState } from "@/app/_lib/action-state";
import { saveZonesAction } from "@/app/painel/loja/actions";

type Row = { key: string; neighborhood: string; fee: string };

export function ZonesEditor({ initialZones }: { initialZones: DeliveryZone[] }) {
  const [rows, setRows] = useState<Row[]>(() =>
    initialZones.map((zone) => ({ key: zone.id, neighborhood: zone.neighborhood, fee: formatCentsForInput(zone.feeCents) })),
  );
  const [state, formAction] = useActionState(saveZonesAction, idleState);

  function update(key: string, patch: Partial<Row>) {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  const payload = rows.map((row) => ({ neighborhood: row.neighborhood, fee: row.fee }));

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="zones" value={JSON.stringify(payload)} />
      <p className="text-sm text-neutral-700 dark:text-neutral-300">Usado quando a taxa de entrega é &quot;Taxa por bairro&quot;.</p>
      <ul className="flex flex-col gap-2">
        {rows.map((row, index) => (
          <li key={row.key} className="flex flex-wrap items-end gap-2">
            <input
              aria-label={`Bairro ${index + 1}`}
              value={row.neighborhood}
              onChange={(event) => update(row.key, { neighborhood: event.target.value })}
              className={inputClass}
            />
            <input
              aria-label={`Taxa ${index + 1}`}
              inputMode="decimal"
              value={row.fee}
              onChange={(event) => update(row.key, { fee: event.target.value })}
              className={`${inputClass} w-28`}
            />
            <button
              type="button"
              onClick={() => setRows((current) => current.filter((item) => item.key !== row.key))}
              className={secondaryButtonClass}
            >
              Remover bairro {index + 1}
            </button>
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setRows((current) => [...current, { key: uuid(), neighborhood: "", fee: "0,00" }])}
          className={secondaryButtonClass}
        >
          Adicionar bairro
        </button>
        <SubmitButton>Salvar bairros</SubmitButton>
      </div>
      {state.status === "error" && (
        <ul className="text-sm text-red-700 dark:text-red-400">
          {Object.entries(state.fieldErrors).map(([field, message]) => (
            <li key={field}>{message}</li>
          ))}
        </ul>
      )}
      <FormMessage state={state} />
    </form>
  );
}
