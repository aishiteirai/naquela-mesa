"use client";

import { uuid } from "@/shared/uuid";
import { useActionState, useState } from "react";
import type { StoreHour } from "@/modules/stores";
import { FormMessage, SubmitButton } from "@/app/_components/form-controls";
import { inputClass, secondaryButtonClass } from "@/app/_components/styles";
import { idleState } from "@/app/_lib/action-state";
import { saveHoursAction } from "@/app/painel/(shell)/loja/actions";

const WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

type Row = StoreHour & { key: string };

export function HoursEditor({ initialHours }: { initialHours: StoreHour[] }) {
  const [rows, setRows] = useState<Row[]>(() => initialHours.map((hour) => ({ ...hour, key: uuid() })));
  const [state, formAction] = useActionState(saveHoursAction, idleState);

  function update(key: string, patch: Partial<StoreHour>) {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  const payload = rows.map((row) => ({ weekday: row.weekday, opensAt: row.opensAt, closesAt: row.closesAt }));

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="hours" value={JSON.stringify(payload)} />
      <p className="text-sm text-neutral-700 dark:text-neutral-300">
        Se o horário de fechar for menor que o de abrir, o turno vira a meia-noite (ex.: 18:00 às 00:30).
      </p>
      <ul className="flex flex-col gap-2">
        {rows.map((row, index) => (
          <li key={row.key} className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="sr-only">Dia do turno {index + 1}</span>
              <select
                aria-label={`Dia do turno ${index + 1}`}
                value={row.weekday}
                onChange={(event) => update(row.key, { weekday: Number(event.target.value) })}
                className={inputClass}
              >
                {WEEKDAYS.map((day, weekday) => (
                  <option key={day} value={weekday}>
                    {day}
                  </option>
                ))}
              </select>
            </label>
            <input
              type="time"
              aria-label={`Abre turno ${index + 1}`}
              value={row.opensAt}
              onChange={(event) => update(row.key, { opensAt: event.target.value })}
              className={inputClass}
            />
            <input
              type="time"
              aria-label={`Fecha turno ${index + 1}`}
              value={row.closesAt}
              onChange={(event) => update(row.key, { closesAt: event.target.value })}
              className={inputClass}
            />
            <button
              type="button"
              onClick={() => setRows((current) => current.filter((item) => item.key !== row.key))}
              className={secondaryButtonClass}
            >
              Remover turno {index + 1}
            </button>
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setRows((current) => [...current, { key: uuid(), weekday: 1, opensAt: "18:00", closesAt: "23:00" }])}
          className={secondaryButtonClass}
        >
          Adicionar turno
        </button>
        <SubmitButton>Salvar horários</SubmitButton>
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
