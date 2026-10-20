"use client";

import { useActionState, useEffect, useId } from "react";
import { ActionForm } from "@/app/_components/action-form";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { EditorCategory, EditorProduct, MenuOptionGroup } from "@/modules/catalog";
import { formatCentsForInput } from "@/shared/money";
import { ImageUploadField } from "@/app/_components/image-upload-field";
import { idleState } from "@/app/_lib/action-state";
import { FieldError, FormMessage, SubmitButton, TextField } from "@/app/_components/form-fields";
import { saveProductAction } from "@/app/painel/(shell)/cardapio/actions";

type Props = {
  category: Pick<EditorCategory, "id" | "name" | "sizes">;
  optionGroups: Pick<MenuOptionGroup, "id" | "name">[];
  product: EditorProduct | null;
  onSaved: () => void;
};

function SwitchField({ name, label, defaultChecked }: { name: string; label: string; defaultChecked: boolean }) {
  const id = useId();
  return (
    <Field orientation="horizontal">
      <Switch id={id} name={name} defaultChecked={defaultChecked} />
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
    </Field>
  );
}

export function ProductForm({ category, optionGroups, product, onSaved }: Props) {
  const [state, formAction, pending] = useActionState(saveProductAction, idleState);
  const descriptionId = useId();
  const hasSizes = category.sizes.length > 0;
  const allowsHalfOption = category.sizes.some((size) => size.maxFlavors === 2);
  const priceFor = (sizeId: string) => product?.sizePrices.find((price) => price.sizeId === sizeId)?.priceCents;

  useEffect(() => {
    if (state.status === "success") onSaved();
  }, [state, onSaved]);

  return (
    <ActionForm action={formAction} pending={pending} className="flex flex-col gap-6">
      <input type="hidden" name="productId" value={product?.id ?? ""} />
      <input type="hidden" name="categoryId" value={category.id} />
      <input type="hidden" name="hasSizes" value={hasSizes ? "1" : "0"} />

      <FieldGroup>
        <TextField label="Nome" name="name" state={state} defaultValue={product?.name} required maxLength={80} />
        <Field>
          <FieldLabel htmlFor={descriptionId}>Descrição</FieldLabel>
          <Textarea id={descriptionId} name="description" defaultValue={product?.description ?? ""} maxLength={300} rows={3} />
          <FieldError state={state} name="description" />
        </Field>
        <ImageUploadField name="imageUrl" label="Foto do produto" defaultUrl={product?.imageUrl ?? null} />
        <FieldError state={state} name="imageUrl" />
      </FieldGroup>

      {hasSizes ? (
        <FieldSet>
          <FieldLegend variant="label">Preços por tamanho</FieldLegend>
          <FieldDescription>Deixe vazio se não vende nesse tamanho.</FieldDescription>
          <div className="grid gap-4 sm:grid-cols-2">
            {category.sizes.map((size) => {
              const cents = priceFor(size.id);
              return (
                <TextField
                  key={size.id}
                  label={`Preço ${size.name}`}
                  name={`price:${size.id}`}
                  state={state}
                  inputMode="decimal"
                  placeholder="0,00"
                  defaultValue={cents === undefined ? "" : formatCentsForInput(cents)}
                />
              );
            })}
          </div>
          <FieldError state={state} name="sizePrices" />
        </FieldSet>
      ) : (
        <TextField
          label="Preço"
          name="price"
          errorKey="priceCents"
          state={state}
          inputMode="decimal"
          placeholder="0,00"
          defaultValue={product?.priceCents == null ? "" : formatCentsForInput(product.priceCents)}
        />
      )}

      {allowsHalfOption && <SwitchField name="allowsHalf" label="Permite meio a meio" defaultChecked={product?.allowsHalf ?? false} />}
      <FieldError state={state} name="allowsHalf" />

      {optionGroups.length > 0 && (
        <FieldSet>
          <FieldLegend variant="label">Adicionais</FieldLegend>
          <FieldGroup data-slot="checkbox-group" className="gap-3">
            {optionGroups.map((group) => (
              <Field key={group.id} orientation="horizontal">
                <Checkbox
                  id={`${descriptionId}-${group.id}`}
                  name="optionGroupIds"
                  value={group.id}
                  defaultChecked={product?.optionGroupIds.includes(group.id) ?? false}
                />
                <FieldLabel htmlFor={`${descriptionId}-${group.id}`} className="font-normal">
                  Adicional: {group.name}
                </FieldLabel>
              </Field>
            ))}
          </FieldGroup>
          <FieldError state={state} name="optionGroupIds" />
        </FieldSet>
      )}

      <SwitchField name="active" label="Ativo (aparece no cardápio)" defaultChecked={product?.active ?? true} />

      <div className="flex flex-col gap-2">
        <SubmitButton size="lg">Salvar produto</SubmitButton>
        {state.status === "error" && <FormMessage state={state} />}
      </div>
    </ActionForm>
  );
}
