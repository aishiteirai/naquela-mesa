"use client";

import { useActionState } from "react";
import { FieldError, SubmitButton } from "@/app/_components/form-controls";
import { inputClass } from "@/app/_components/styles";
import { createStoreAction, type AdminLinkState } from "@/app/admin/actions";
import { InviteLink } from "./invite-link";

type Props = { templates: { value: string; label: string }[] };

export function CreateStoreForm({ templates }: Props) {
  const [state, formAction] = useActionState<AdminLinkState, FormData>(createStoreAction, { status: "idle" });
  const fieldState = state.status === "link" ? ({ status: "idle" } as const) : state;

  return (
    <form action={formAction} aria-label="Nova loja" className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          Nome da loja
          <input name="name" required maxLength={120} className={inputClass} />
          <FieldError state={fieldState} name="name" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Endereço (slug)
          <input name="slug" required maxLength={60} pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="pizzaria-do-joao" className={inputClass} />
          <FieldError state={fieldState} name="slug" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          WhatsApp da loja
          <input name="whatsapp" required inputMode="tel" placeholder="(11) 99999-9999" className={inputClass} />
          <FieldError state={fieldState} name="whatsapp" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Email do dono
          <input name="ownerEmail" type="email" required className={inputClass} />
          <FieldError state={fieldState} name="ownerEmail" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Modelo de cardápio
          <select name="template" required defaultValue="pizzaria" className={inputClass}>
            {templates.map((template) => (
              <option key={template.value} value={template.value}>
                {template.label}
              </option>
            ))}
          </select>
          <FieldError state={fieldState} name="template" />
        </label>
      </div>
      <div>
        <SubmitButton pendingText="Criando...">Criar loja</SubmitButton>
      </div>
      {state.status !== "idle" && (
        <p role="status" className={state.status === "error" ? "text-sm text-red-700 dark:text-red-400" : "text-sm text-green-800 dark:text-green-300"}>
          {state.message}
        </p>
      )}
      {state.status === "link" && state.inviteUrl && <InviteLink url={state.inviteUrl} />}
    </form>
  );
}
