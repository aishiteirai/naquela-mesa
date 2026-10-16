"use client";

import { ArrowDownIcon, ArrowUpIcon, Trash2Icon } from "lucide-react";
import { useActionState, useEffect, useId, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { EditorSize } from "@/modules/catalog";
import { idleState } from "@/app/_lib/action-state";
import { FormMessage, SubmitButton, TextField } from "@/app/_components/form-fields";
import { createSizeAction, deleteSizeAction, moveSizeAction, updateSizeAction } from "@/app/painel/(shell)/cardapio/actions";

function FlavorsSelect({ label, defaultValue }: { label: string; defaultValue: number }) {
  const id = useId();
  return (
    <Field className="sm:w-40">
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Select name="maxFlavors" defaultValue={String(defaultValue)}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="1">1 sabor</SelectItem>
          <SelectItem value="2">até 2 sabores</SelectItem>
        </SelectContent>
      </Select>
    </Field>
  );
}

function SizeRow({ size, isFirst, isLast }: { size: EditorSize; isFirst: boolean; isLast: boolean }) {
  const [state, formAction] = useActionState(updateSizeAction, idleState);

  return (
    <li className="flex flex-col gap-3 rounded-lg border p-3">
      {/* key: o reset do <form> após a action faria o Select voltar ao valor do mount; remonta com o valor salvo. */}
      <form key={`${size.name}:${size.maxFlavors}`} action={formAction} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <input type="hidden" name="sizeId" value={size.id} />
        <TextField label="Tamanho" name="name" state={state} defaultValue={size.name} required maxLength={80} />
        <FlavorsSelect label="Sabores" defaultValue={size.maxFlavors} />
        <SubmitButton variant="outline">Salvar tamanho</SubmitButton>
      </form>
      <FormMessage state={state} />
      <div className="flex flex-wrap gap-2">
        <form action={moveSizeAction} className="flex gap-1">
          <input type="hidden" name="sizeId" value={size.id} />
          <Button type="submit" name="direction" value="up" variant="ghost" size="icon-sm" disabled={isFirst} aria-label={`Subir ${size.name}`}>
            <ArrowUpIcon />
          </Button>
          <Button type="submit" name="direction" value="down" variant="ghost" size="icon-sm" disabled={isLast} aria-label={`Descer ${size.name}`}>
            <ArrowDownIcon />
          </Button>
        </form>
        <form
          action={deleteSizeAction}
          onSubmit={(event) => {
            if (!window.confirm(`Remover o tamanho ${size.name}? Os preços desse tamanho serão apagados.`)) event.preventDefault();
          }}
          className="ml-auto"
        >
          <input type="hidden" name="sizeId" value={size.id} />
          <Button type="submit" variant="ghost" size="sm" className="text-destructive">
            <Trash2Icon />
            Remover tamanho {size.name}
          </Button>
        </form>
      </div>
    </li>
  );
}

export function SizesEditor({ categoryId, sizes }: { categoryId: string; sizes: EditorSize[] }) {
  const [state, formAction] = useActionState(createSizeAction, idleState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state]);

  return (
    <div className="flex flex-col gap-4">
      {sizes.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {sizes.map((size, index) => (
            <SizeRow key={size.id} size={size} isFirst={index === 0} isLast={index === sizes.length - 1} />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">Sem tamanhos: os produtos têm preço único.</p>
      )}
      <form ref={formRef} action={formAction} className="flex flex-col gap-3 rounded-lg border border-dashed p-3 sm:flex-row sm:items-end">
        <input type="hidden" name="categoryId" value={categoryId} />
        <TextField label="Novo tamanho" name="name" state={state} required maxLength={80} placeholder="Ex.: Grande" />
        <FlavorsSelect label="Sabores do novo tamanho" defaultValue={1} />
        <SubmitButton>Adicionar tamanho</SubmitButton>
      </form>
      <FormMessage state={state} />
    </div>
  );
}
