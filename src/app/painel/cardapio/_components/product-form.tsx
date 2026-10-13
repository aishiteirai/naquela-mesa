"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { EditorCategory, EditorProduct, MenuOptionGroup } from "@/modules/catalog";
import { formatCentsForInput } from "@/shared/money";
import { ImageUploadField } from "@/app/_components/image-upload-field";
import { FieldError, FormMessage, SubmitButton } from "@/app/_components/form-controls";
import { inputClass } from "@/app/_components/styles";
import { idleState } from "@/app/_lib/action-state";
import { saveProductAction } from "@/app/painel/cardapio/actions";

type Props = {
  category: Pick<EditorCategory, "id" | "name" | "sizes">;
  optionGroups: Pick<MenuOptionGroup, "id" | "name">[];
  product: EditorProduct | null;
};

export function ProductForm({ category, optionGroups, product }: Props) {
  const [state, formAction] = useActionState(saveProductAction, idleState);
  const hasSizes = category.sizes.length > 0;
  const allowsHalfOption = category.sizes.some((size) => size.maxFlavors === 2);
  const priceFor = (sizeId: string) => product?.sizePrices.find((price) => price.sizeId === sizeId)?.priceCents;

  return (
    <form action={formAction} className="flex max-w-xl flex-col gap-4">
      <input type="hidden" name="productId" value={product?.id ?? ""} />
      <input type="hidden" name="categoryId" value={category.id} />
      <input type="hidden" name="hasSizes" value={hasSizes ? "1" : "0"} />

      <p className="text-sm text-neutral-700 dark:text-neutral-300">Categoria: {category.name}</p>

      <label className="flex flex-col gap-1 text-sm">
        Nome
        <input name="name" defaultValue={product?.name} required maxLength={80} className={inputClass} />
      </label>
      <FieldError state={state} name="name" />

      <label className="flex flex-col gap-1 text-sm">
        Descrição
        <textarea name="description" defaultValue={product?.description ?? ""} maxLength={300} rows={3} className={inputClass} />
      </label>
      <FieldError state={state} name="description" />

      <ImageUploadField name="imageUrl" label="Foto do produto" defaultUrl={product?.imageUrl ?? null} />
      <FieldError state={state} name="imageUrl" />

      {hasSizes ? (
        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium">Preços por tamanho (deixe vazio se não vende nesse tamanho)</legend>
          {category.sizes.map((size) => {
            const cents = priceFor(size.id);
            return (
              <div key={size.id} className="flex flex-col gap-1">
                <label className="flex flex-col gap-1 text-sm">
                  Preço {size.name}
                  <input
                    name={`price:${size.id}`}
                    inputMode="decimal"
                    placeholder="0,00"
                    defaultValue={cents === undefined ? "" : formatCentsForInput(cents)}
                    className={inputClass}
                  />
                </label>
                <FieldError state={state} name={`price:${size.id}`} />
              </div>
            );
          })}
          <FieldError state={state} name="sizePrices" />
        </fieldset>
      ) : (
        <>
          <label className="flex flex-col gap-1 text-sm">
            Preço
            <input
              name="price"
              inputMode="decimal"
              placeholder="0,00"
              defaultValue={product?.priceCents == null ? "" : formatCentsForInput(product.priceCents)}
              className={inputClass}
            />
          </label>
          <FieldError state={state} name="priceCents" />
        </>
      )}

      {allowsHalfOption && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="allowsHalf" defaultChecked={product?.allowsHalf ?? false} />
          Permite meio a meio
        </label>
      )}
      <FieldError state={state} name="allowsHalf" />

      {optionGroups.length > 0 && (
        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium">Adicionais</legend>
          {optionGroups.map((group) => (
            <label key={group.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="optionGroupIds"
                value={group.id}
                defaultChecked={product?.optionGroupIds.includes(group.id) ?? false}
              />
              Adicional: {group.name}
            </label>
          ))}
          <FieldError state={state} name="optionGroupIds" />
        </fieldset>
      )}

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="active" defaultChecked={product?.active ?? true} />
        Ativo
      </label>

      <div className="flex items-center gap-3">
        <SubmitButton>Salvar produto</SubmitButton>
        <Link href="/painel/cardapio" className="text-sm underline">
          Cancelar
        </Link>
      </div>
      <FormMessage state={state} />
    </form>
  );
}
