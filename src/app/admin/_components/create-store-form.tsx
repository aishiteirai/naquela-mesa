"use client";

import { useActionState } from "react";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { FormMessage, SubmitButton, TextField, fieldErrorOf } from "@/app/_components/form-fields";
import { NativeSelect } from "@/app/_components/native-select";
import { createStoreAction, type AdminLinkState } from "@/app/admin/actions";
import { InviteLink } from "./invite-link";

type Props = { templates: { value: string; label: string }[] };

export function CreateStoreForm({ templates }: Props) {
  const [state, formAction] = useActionState<AdminLinkState, FormData>(createStoreAction, { status: "idle" });
  const fieldState = state.status === "link" ? ({ status: "idle" } as const) : state;
  const templateError = fieldErrorOf(fieldState, "template");

  return (
    <form action={formAction} aria-label="Nova loja" className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Nome da loja" name="name" state={fieldState} required maxLength={120} />
        <TextField label="Endereço (slug)" name="slug" state={fieldState} required maxLength={60} pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="pizzaria-do-joao" />
        <TextField label="WhatsApp da loja" name="whatsapp" state={fieldState} required inputMode="tel" placeholder="(11) 99999-9999" />
        <TextField label="Email do dono" name="ownerEmail" type="email" state={fieldState} required />
        <Field data-invalid={templateError ? true : undefined}>
          <FieldLabel htmlFor="modelo-cardapio">Modelo de cardápio</FieldLabel>
          <NativeSelect id="modelo-cardapio" name="template" required defaultValue="pizzaria">
            {templates.map((template) => (
              <option key={template.value} value={template.value}>
                {template.label}
              </option>
            ))}
          </NativeSelect>
          {templateError && <FieldError>{templateError}</FieldError>}
        </Field>
      </div>
      <SubmitButton pendingText="Criando..." className="self-start">
        Criar loja
      </SubmitButton>
      {state.status === "link" ? (
        <p role="status" className="text-sm text-muted-foreground">
          {state.message}
        </p>
      ) : (
        <FormMessage state={state} />
      )}
      {state.status === "link" && state.inviteUrl && <InviteLink url={state.inviteUrl} />}
    </form>
  );
}
