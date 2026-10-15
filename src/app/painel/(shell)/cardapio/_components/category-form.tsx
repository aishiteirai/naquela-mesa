"use client";

import { useActionState } from "react";
import { FieldError, FormMessage, SubmitButton } from "@/app/_components/form-controls";
import { inputClass } from "@/app/_components/styles";
import { idleState } from "@/app/_lib/action-state";
import { updateCategoryAction } from "@/app/painel/(shell)/cardapio/actions";

export function CategoryForm({ categoryId, name, active }: { categoryId: string; name: string; active: boolean }) {
  const [state, formAction] = useActionState(updateCategoryAction, idleState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="categoryId" value={categoryId} />
      <label className="flex flex-col gap-1 text-sm">
        Nome da categoria
        <input name="name" defaultValue={name} required maxLength={80} className={inputClass} />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="active" defaultChecked={active} />
        Ativa
      </label>
      <SubmitButton>Salvar categoria</SubmitButton>
      <FieldError state={state} name="name" />
      <FormMessage state={state} />
    </form>
  );
}
