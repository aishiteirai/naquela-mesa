"use client";

import { useActionState, useEffect, useRef } from "react";
import { FieldError, FormMessage, SubmitButton } from "@/app/_components/form-controls";
import { inputClass } from "@/app/_components/styles";
import { idleState } from "@/app/_lib/action-state";
import { createCategoryAction } from "@/app/painel/cardapio/actions";

export function NewCategoryForm() {
  const [state, formAction] = useActionState(createCategoryAction, idleState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-wrap items-end gap-2">
      <label className="flex flex-col gap-1 text-sm">
        Nova categoria
        <input name="name" required maxLength={80} className={inputClass} />
      </label>
      <SubmitButton>Adicionar categoria</SubmitButton>
      <FieldError state={state} name="name" />
      <FormMessage state={state} />
    </form>
  );
}
