"use client";

import { useActionState, useEffect } from "react";
import { ActionForm } from "@/app/_components/action-form";
import type { MenuOption, MenuOptionGroup } from "@/modules/catalog";
import { formatCentsForInput } from "@/shared/money";
import { idleState } from "@/app/_lib/action-state";
import { FormMessage, SubmitButton, TextField } from "@/app/_components/form-fields";
import {
  addOptionAction,
  createOptionGroupAction,
  updateOptionAction,
  updateOptionGroupAction,
} from "@/app/painel/(shell)/cardapio/adicionais/actions";

type Done = { onDone: () => void };

function useDoneOnSuccess(state: { status: string }, onDone: () => void) {
  useEffect(() => {
    if (state.status === "success") onDone();
  }, [state, onDone]);
}

/** Cria (sem `group`) ou edita um grupo de adicionais. */
export function OptionGroupForm({ group, onDone }: { group: MenuOptionGroup | null } & Done) {
  const [state, formAction, pending] = useActionState(group ? updateOptionGroupAction : createOptionGroupAction, idleState);
  useDoneOnSuccess(state, onDone);

  return (
    <ActionForm action={formAction} pending={pending} className="flex flex-col gap-6">
      {group && <input type="hidden" name="groupId" value={group.id} />}
      <TextField label="Nome do grupo" name="name" state={state} defaultValue={group?.name} placeholder="Ex.: Borda recheada" required maxLength={80} />
      <div className="grid grid-cols-2 gap-4">
        <TextField label="Mínimo" name="minSelect" type="number" min={0} state={state} defaultValue={group?.minSelect ?? 0} required />
        <TextField label="Máximo" name="maxSelect" type="number" min={1} state={state} defaultValue={group?.maxSelect ?? 1} required />
      </div>
      <div className="flex flex-col gap-2">
        <SubmitButton>{group ? "Salvar grupo" : "Criar grupo"}</SubmitButton>
        {state.status === "error" && <FormMessage state={state} />}
      </div>
    </ActionForm>
  );
}

/** Adiciona uma opção ao grupo (sem `option`) ou edita nome e preço; a disponibilidade fica na chave da linha. */
export function OptionForm({ groupId, option, onDone }: { groupId: string; option: MenuOption | null } & Done) {
  const [state, formAction, pending] = useActionState(option ? updateOptionAction : addOptionAction, idleState);
  useDoneOnSuccess(state, onDone);

  return (
    <ActionForm action={formAction} pending={pending} className="flex flex-col gap-6">
      {option ? (
        <>
          <input type="hidden" name="optionId" value={option.id} />
          {option.available && <input type="hidden" name="available" value="on" />}
        </>
      ) : (
        <input type="hidden" name="groupId" value={groupId} />
      )}
      <TextField label="Opção" name="name" state={state} defaultValue={option?.name} placeholder="Ex.: Catupiry" required maxLength={80} />
      <TextField
        label="Preço"
        name="price"
        errorKey="priceCents"
        state={state}
        inputMode="decimal"
        placeholder="0,00"
        defaultValue={option ? formatCentsForInput(option.priceCents) : ""}
      />
      <div className="flex flex-col gap-2">
        <SubmitButton>{option ? "Salvar opção" : "Adicionar opção"}</SubmitButton>
        {state.status === "error" && <FormMessage state={state} />}
      </div>
    </ActionForm>
  );
}
