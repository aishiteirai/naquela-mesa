"use client";

import { useActionState } from "react";
import type { EditorSize } from "@/modules/catalog";
import { FieldError, FormMessage, SubmitButton } from "@/app/_components/form-controls";
import { inputClass, secondaryButtonClass } from "@/app/_components/styles";
import { idleState } from "@/app/_lib/action-state";
import { createSizeAction, deleteSizeAction, moveSizeAction, updateSizeAction } from "@/app/painel/cardapio/actions";

function FlavorsSelect({ name, label, defaultValue }: { name: string; label: string; defaultValue: number }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      {label}
      <select name={name} defaultValue={String(defaultValue)} className={inputClass}>
        <option value="1">1 sabor</option>
        <option value="2">até 2 sabores</option>
      </select>
    </label>
  );
}

function SizeRow({ size, isFirst, isLast }: { size: EditorSize; isFirst: boolean; isLast: boolean }) {
  const [state, formAction] = useActionState(updateSizeAction, idleState);

  return (
    <li className="flex flex-wrap items-end gap-2">
      <form action={formAction} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="sizeId" value={size.id} />
        <label className="flex flex-col gap-1 text-sm">
          Tamanho
          <input name="name" defaultValue={size.name} required maxLength={80} className={inputClass} />
        </label>
        <FlavorsSelect name="maxFlavors" label="Sabores" defaultValue={size.maxFlavors} />
        <SubmitButton>Salvar tamanho</SubmitButton>
        <FieldError state={state} name="name" />
        <FormMessage state={state} />
      </form>
      <form action={moveSizeAction} className="flex gap-1">
        <input type="hidden" name="sizeId" value={size.id} />
        <button type="submit" name="direction" value="up" disabled={isFirst} aria-label={`Subir ${size.name}`} className={secondaryButtonClass}>
          ↑
        </button>
        <button type="submit" name="direction" value="down" disabled={isLast} aria-label={`Descer ${size.name}`} className={secondaryButtonClass}>
          ↓
        </button>
      </form>
      <form
        action={deleteSizeAction}
        onSubmit={(event) => {
          if (!window.confirm(`Remover o tamanho ${size.name}? Os preços desse tamanho serão apagados.`)) event.preventDefault();
        }}
      >
        <input type="hidden" name="sizeId" value={size.id} />
        <button type="submit" className={secondaryButtonClass}>
          Remover tamanho {size.name}
        </button>
      </form>
    </li>
  );
}

export function SizesEditor({ categoryId, sizes }: { categoryId: string; sizes: EditorSize[] }) {
  const [state, formAction] = useActionState(createSizeAction, idleState);

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold">Tamanhos</h3>
      {sizes.length > 0 && (
        <ul className="flex flex-col gap-3">
          {sizes.map((size, index) => (
            <SizeRow key={size.id} size={size} isFirst={index === 0} isLast={index === sizes.length - 1} />
          ))}
        </ul>
      )}
      <form action={formAction} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="categoryId" value={categoryId} />
        <label className="flex flex-col gap-1 text-sm">
          Novo tamanho
          <input name="name" required maxLength={80} className={inputClass} />
        </label>
        <FlavorsSelect name="maxFlavors" label="Sabores do novo tamanho" defaultValue={1} />
        <SubmitButton>Adicionar tamanho</SubmitButton>
        <FieldError state={state} name="name" />
        <FormMessage state={state} />
      </form>
    </div>
  );
}
