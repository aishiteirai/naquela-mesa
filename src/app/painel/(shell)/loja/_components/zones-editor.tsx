"use client";

import { PlusIcon, Trash2Icon } from "lucide-react";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { FieldDescription } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { DeliveryZone } from "@/modules/stores";
import { formatCentsForInput } from "@/shared/money";
import { uuid } from "@/shared/uuid";
import { idleState } from "@/app/_lib/action-state";
import { FormMessage, SubmitButton } from "@/app/_components/form-fields";
import { saveZonesAction } from "@/app/painel/(shell)/loja/actions";

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
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="zones" value={JSON.stringify(payload)} />
      <FieldDescription>Usado quando a taxa de entrega é &quot;Taxa por bairro&quot;.</FieldDescription>
      {rows.length > 0 && (
        <ul className="flex flex-col gap-2">
          {rows.map((row, index) => (
            <li key={row.key} className="flex items-center gap-2">
              <Input
                aria-label={`Bairro ${index + 1}`}
                placeholder="Bairro"
                value={row.neighborhood}
                onChange={(event) => update(row.key, { neighborhood: event.target.value })}
                className="min-w-0 flex-1"
              />
              <Input
                aria-label={`Taxa ${index + 1}`}
                inputMode="decimal"
                value={row.fee}
                onChange={(event) => update(row.key, { fee: event.target.value })}
                className="w-24"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Remover bairro ${index + 1}`}
                onClick={() => setRows((current) => current.filter((item) => item.key !== row.key))}
              >
                <Trash2Icon />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={() => setRows((current) => [...current, { key: uuid(), neighborhood: "", fee: "0,00" }])}>
          <PlusIcon />
          Adicionar bairro
        </Button>
        <SubmitButton>Salvar bairros</SubmitButton>
      </div>
      {state.status === "error" && (
        <ul role="alert" className="text-sm text-destructive">
          {Object.entries(state.fieldErrors).map(([field, message]) => (
            <li key={field}>{message}</li>
          ))}
        </ul>
      )}
      <FormMessage state={state} />
    </form>
  );
}
