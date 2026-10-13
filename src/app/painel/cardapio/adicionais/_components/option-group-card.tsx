"use client";

import { useActionState } from "react";
import type { MenuOption, MenuOptionGroup } from "@/modules/catalog";
import { formatCentsForInput } from "@/shared/money";
import { FieldError, FormMessage, SubmitButton } from "@/app/_components/form-controls";
import { inputClass } from "@/app/_components/styles";
import { idleState } from "@/app/_lib/action-state";
import { addOptionAction, updateOptionAction, updateOptionGroupAction } from "@/app/painel/cardapio/adicionais/actions";

function OptionRow({ option }: { option: MenuOption }) {
  const [state, formAction] = useActionState(updateOptionAction, idleState);

  return (
    <li>
      <form action={formAction} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="optionId" value={option.id} />
        <label className="flex flex-col gap-1 text-sm">
          Opção
          <input name="name" defaultValue={option.name} required maxLength={80} className={inputClass} />
        </label>
        <label className="flex w-28 flex-col gap-1 text-sm">
          Preço
          <input name="price" inputMode="decimal" defaultValue={formatCentsForInput(option.priceCents)} className={inputClass} />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="available" defaultChecked={option.available} />
          Disponível
        </label>
        <SubmitButton>Salvar opção</SubmitButton>
        <FieldError state={state} name="name" />
        <FieldError state={state} name="priceCents" />
        <FormMessage state={state} />
      </form>
    </li>
  );
}

export function OptionGroupCard({ group }: { group: MenuOptionGroup }) {
  const [groupState, groupAction] = useActionState(updateOptionGroupAction, idleState);
  const [optionState, optionAction] = useActionState(addOptionAction, idleState);

  return (
    <section aria-label={group.name} className="flex flex-col gap-4 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
      <h2 className="text-lg font-semibold">{group.name}</h2>

      <form action={groupAction} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="groupId" value={group.id} />
        <label className="flex flex-col gap-1 text-sm">
          Nome do grupo
          <input name="name" defaultValue={group.name} required maxLength={80} className={inputClass} />
        </label>
        <label className="flex w-24 flex-col gap-1 text-sm">
          Mínimo
          <input name="minSelect" type="number" min={0} defaultValue={group.minSelect} required className={inputClass} />
        </label>
        <label className="flex w-24 flex-col gap-1 text-sm">
          Máximo
          <input name="maxSelect" type="number" min={1} defaultValue={group.maxSelect} required className={inputClass} />
        </label>
        <SubmitButton>Salvar grupo</SubmitButton>
        <FieldError state={groupState} name="name" />
        <FieldError state={groupState} name="minSelect" />
        <FormMessage state={groupState} />
      </form>

      <ul className="flex flex-col gap-3">
        {group.options.map((option) => (
          <OptionRow key={option.id} option={option} />
        ))}
      </ul>

      <form action={optionAction} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="groupId" value={group.id} />
        <label className="flex flex-col gap-1 text-sm">
          Nova opção
          <input name="name" required maxLength={80} className={inputClass} />
        </label>
        <label className="flex w-28 flex-col gap-1 text-sm">
          Preço da nova opção
          <input name="price" inputMode="decimal" placeholder="0,00" className={inputClass} />
        </label>
        <SubmitButton>Adicionar opção</SubmitButton>
        <FieldError state={optionState} name="name" />
        <FieldError state={optionState} name="priceCents" />
        <FormMessage state={optionState} />
      </form>
    </section>
  );
}
