"use client";

import { useActionState, useEffect, useRef } from "react";
import { FieldError, FormMessage, SubmitButton } from "@/app/_components/form-controls";
import { inputClass } from "@/app/_components/styles";
import { idleState } from "@/app/_lib/action-state";
import { createOptionGroupAction } from "@/app/painel/(shell)/cardapio/adicionais/actions";

export function NewOptionGroupForm() {
  const [state, formAction] = useActionState(createOptionGroupAction, idleState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-wrap items-end gap-2">
      <label className="flex flex-col gap-1 text-sm">
        Novo grupo
        <input name="name" required maxLength={80} placeholder="Ex.: Borda recheada" className={inputClass} />
      </label>
      <label className="flex w-24 flex-col gap-1 text-sm">
        Mínimo
        <input name="minSelect" type="number" min={0} defaultValue={0} required className={inputClass} />
      </label>
      <label className="flex w-24 flex-col gap-1 text-sm">
        Máximo
        <input name="maxSelect" type="number" min={1} defaultValue={1} required className={inputClass} />
      </label>
      <SubmitButton>Criar grupo</SubmitButton>
      <FieldError state={state} name="name" />
      <FieldError state={state} name="minSelect" />
      <FieldError state={state} name="maxSelect" />
      <FormMessage state={state} />
    </form>
  );
}
