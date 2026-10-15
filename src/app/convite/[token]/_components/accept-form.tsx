"use client";

import { useActionState } from "react";
import { FieldGroup } from "@/components/ui/field";
import { idleState, type ActionState } from "@/app/_lib/action-state";
import { FormMessage, SubmitButton, TextField } from "@/app/_components/form-fields";

type Props = {
  action: (prev: ActionState, form: FormData) => Promise<ActionState>;
  email: string;
  hasAccount: boolean;
};

export function AcceptForm({ action, email, hasAccount }: Props) {
  const [state, formAction] = useActionState(action, idleState);
  return (
    <form action={formAction} className="flex flex-col gap-6">
      <FieldGroup>
        <TextField label="Email" errorKey="email" state={state} value={email} readOnly />
        {!hasAccount && <TextField label="Seu nome" name="name" state={state} required maxLength={80} autoComplete="name" />}
        <TextField label="Senha" name="password" type="password" state={state} required minLength={8} maxLength={128} autoComplete="new-password" />
        <TextField label="Confirmar senha" name="confirm" type="password" state={state} required minLength={8} maxLength={128} autoComplete="new-password" />
      </FieldGroup>
      <FormMessage state={state} />
      <SubmitButton size="lg" pendingText="Salvando...">
        {hasAccount ? "Definir nova senha" : "Criar acesso"}
      </SubmitButton>
    </form>
  );
}
