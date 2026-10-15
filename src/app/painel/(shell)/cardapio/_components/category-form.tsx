"use client";

import { useActionState, useEffect, useId } from "react";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { idleState } from "@/app/_lib/action-state";
import { FormMessage, SubmitButton, TextField } from "@/app/painel/_components/form-fields";
import { createCategoryAction, updateCategoryAction } from "@/app/painel/(shell)/cardapio/actions";

/** Renomear / ativar uma categoria (sem `categoryId`: cria uma nova). Chama `onDone` ao salvar. */
export function CategoryForm({
  category,
  onDone,
}: {
  category: { id: string; name: string; active: boolean } | null;
  onDone: () => void;
}) {
  const [state, formAction] = useActionState(category ? updateCategoryAction : createCategoryAction, idleState);
  const activeId = useId();

  useEffect(() => {
    if (state.status === "success") onDone();
  }, [state, onDone]);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {category && <input type="hidden" name="categoryId" value={category.id} />}
      <FieldGroup>
        <TextField
          label={category ? "Nome da categoria" : "Nova categoria"}
          name="name"
          state={state}
          defaultValue={category?.name}
          placeholder={category ? undefined : "Ex.: Pizzas"}
          required
          maxLength={80}
        />
        {category && (
          <Field orientation="horizontal">
            <Switch id={activeId} name="active" defaultChecked={category.active} />
            <FieldLabel htmlFor={activeId}>Ativa (aparece no cardápio)</FieldLabel>
          </Field>
        )}
      </FieldGroup>
      <div className="flex flex-col gap-2">
        <SubmitButton>{category ? "Salvar categoria" : "Adicionar categoria"}</SubmitButton>
        {state.status === "error" && <FormMessage state={state} />}
      </div>
    </form>
  );
}
