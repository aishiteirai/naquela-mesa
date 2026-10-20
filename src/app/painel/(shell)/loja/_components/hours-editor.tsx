"use client";

import { PlusIcon, Trash2Icon } from "lucide-react";
import { useActionState, useState } from "react";
import { ActionForm } from "@/app/_components/action-form";
import { Button } from "@/components/ui/button";
import { FieldDescription } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { StoreHour } from "@/modules/stores";
import { uuid } from "@/shared/uuid";
import { idleState } from "@/app/_lib/action-state";
import { FormMessage, SubmitButton } from "@/app/_components/form-fields";
import { saveHoursAction } from "@/app/painel/(shell)/loja/actions";

const WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

type Row = StoreHour & { key: string };

export function HoursEditor({ initialHours }: { initialHours: StoreHour[] }) {
  const [rows, setRows] = useState<Row[]>(() => initialHours.map((hour) => ({ ...hour, key: uuid() })));
  const [state, formAction, pending] = useActionState(saveHoursAction, idleState);

  function update(key: string, patch: Partial<StoreHour>) {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  const payload = rows.map((row) => ({ weekday: row.weekday, opensAt: row.opensAt, closesAt: row.closesAt }));

  return (
    <ActionForm action={formAction} pending={pending} className="flex flex-col gap-4">
      <input type="hidden" name="hours" value={JSON.stringify(payload)} />
      <FieldDescription>Se o horário de fechar for menor que o de abrir, o turno vira a meia-noite (ex.: 18:00 às 00:30).</FieldDescription>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum turno cadastrado.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((row, index) => (
            <li key={row.key} className="flex flex-wrap items-center gap-2">
              <Select value={String(row.weekday)} onValueChange={(value) => update(row.key, { weekday: Number(value) })}>
                <SelectTrigger aria-label={`Dia do turno ${index + 1}`} className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WEEKDAYS.map((day, weekday) => (
                    <SelectItem key={day} value={String(weekday)}>
                      {day}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="time"
                aria-label={`Abre turno ${index + 1}`}
                value={row.opensAt}
                onChange={(event) => update(row.key, { opensAt: event.target.value })}
                className="w-28"
              />
              <span className="text-sm text-muted-foreground">às</span>
              <Input
                type="time"
                aria-label={`Fecha turno ${index + 1}`}
                value={row.closesAt}
                onChange={(event) => update(row.key, { closesAt: event.target.value })}
                className="w-28"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Remover turno ${index + 1}`}
                onClick={() => setRows((current) => current.filter((item) => item.key !== row.key))}
              >
                <Trash2Icon />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => setRows((current) => [...current, { key: uuid(), weekday: 1, opensAt: "18:00", closesAt: "23:00" }])}
        >
          <PlusIcon />
          Adicionar turno
        </Button>
        <SubmitButton>Salvar horários</SubmitButton>
      </div>
      {state.status === "error" && (
        <ul role="alert" className="text-sm text-destructive">
          {Object.entries(state.fieldErrors).map(([field, message]) => (
            <li key={field}>{message}</li>
          ))}
        </ul>
      )}
      <FormMessage state={state} />
    </ActionForm>
  );
}
