"use client";

import { useActionState } from "react";
import { FieldError, FormMessage, SubmitButton } from "@/app/_components/form-controls";
import { inputClass } from "@/app/_components/styles";
import { idleState, type ActionState } from "@/app/_lib/action-state";

type Props = {
  action: (prev: ActionState, form: FormData) => Promise<ActionState>;
  email: string;
  hasAccount: boolean;
};

export function AcceptForm({ action, email, hasAccount }: Props) {
  const [state, formAction] = useActionState(action, idleState);
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        Email
        <input value={email} readOnly className={inputClass} />
        <FieldError state={state} name="email" />
      </label>
      {!hasAccount && (
        <label className="flex flex-col gap-1 text-sm">
          Seu nome
          <input name="name" required maxLength={80} autoComplete="name" className={inputClass} />
          <FieldError state={state} name="name" />
        </label>
      )}
      <label className="flex flex-col gap-1 text-sm">
        Senha
        <input name="password" type="password" required minLength={8} maxLength={128} autoComplete="new-password" className={inputClass} />
        <FieldError state={state} name="password" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Confirmar senha
        <input name="confirm" type="password" required minLength={8} maxLength={128} autoComplete="new-password" className={inputClass} />
        <FieldError state={state} name="confirm" />
      </label>
      <FormMessage state={state} />
      <SubmitButton pendingText="Salvando...">{hasAccount ? "Definir nova senha" : "Criar acesso"}</SubmitButton>
    </form>
  );
}
