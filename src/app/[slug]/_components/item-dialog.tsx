"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { MenuOptionGroup, MenuProduct } from "@/modules/catalog";
import { describeLine, MAX_ITEM_QUANTITY, priceItem, type CartItemInput, type PricedLine } from "@/modules/orders/client";
import { isDomainError } from "@/shared/errors";
import { formatBRL } from "@/shared/money";
import { useCart } from "./cart-context";
import { usePricingContext } from "./menu-provider";

function errorText(error: unknown): string {
  if (!isDomainError(error)) return "Não foi possível calcular o preço.";
  if (error.code === "INVALID_OPTIONS") return String(error.details.reason ?? "Revise as opções.");
  if (error.code === "ITEM_UNAVAILABLE") return `${String(error.details.name ?? "Item")} está esgotado.`;
  return "Revise as opções.";
}

export function ItemDialog({ productId, onClose }: { productId: string; onClose: () => void }) {
  const ctx = usePricingContext();
  const cart = useCart();
  const dialogRef = useRef<HTMLDialogElement>(null);

  const category = ctx.menu.categories.find((item) => item.products.some((product) => product.id === productId))!;
  const product = category.products.find((item) => item.id === productId)!;
  const sizes = category.sizes.filter((size) => product.sizePrices.some((price) => price.sizeId === size.id));

  const [sizeId, setSizeId] = useState(sizes[0]?.id ?? "");
  const [secondFlavorId, setSecondFlavorId] = useState("");
  const [optionIds, setOptionIds] = useState<string[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  const size = sizes.find((item) => item.id === sizeId);
  const halfAllowed = Boolean(size && size.maxFlavors > 1 && product.allowsHalf && ctx.halfAndHalfEnabled);
  const secondFlavors: MenuProduct[] = halfAllowed
    ? category.products.filter(
        (item) => item.id !== product.id && item.allowsHalf && item.available && item.sizePrices.some((price) => price.sizeId === sizeId),
      )
    : [];
  const flavorIds = halfAllowed && secondFlavorId ? [product.id, secondFlavorId] : [product.id];

  const groups: MenuOptionGroup[] = ctx.addonsEnabled
    ? [
        ...new Set(
          flavorIds.flatMap((id) => category.products.find((item) => item.id === id)?.optionGroupIds ?? []),
        ),
      ]
        .map((groupId) => ctx.menu.optionGroups.find((group) => group.id === groupId))
        .filter((group): group is MenuOptionGroup => group !== undefined)
    : [];

  const visibleOptionIds = new Set(groups.flatMap((group) => group.options.map((option) => option.id)));
  const activeOptionIds = optionIds.filter((id) => visibleOptionIds.has(id));

  const input: CartItemInput =
    sizes.length > 0
      ? { kind: "sized", sizeId, flavorIds, optionIds: activeOptionIds, quantity, notes: notes.trim() || null }
      : { kind: "simple", productId: product.id, optionIds: activeOptionIds, quantity, notes: notes.trim() || null };

  const priced = useMemo<{ line: PricedLine } | { error: string }>(() => {
    try {
      return { line: priceItem(ctx, input, 0) };
    } catch (error) {
      return { error: errorText(error) };
    }
    // input é derivado dos estados abaixo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx, sizeId, secondFlavorId, optionIds, quantity, notes]);

  function toggleOption(group: MenuOptionGroup, optionId: string, checked: boolean) {
    setOptionIds((current) => {
      const groupOptionIds = new Set(group.options.map((option) => option.id));
      if (group.maxSelect === 1) return [...current.filter((id) => !groupOptionIds.has(id)), ...(checked && optionId ? [optionId] : [])];
      return checked ? [...current, optionId] : current.filter((id) => id !== optionId);
    });
  }

  function addToCart() {
    if (!("line" in priced)) return;
    cart.add({ input, label: describeLine(priced.line), unitPriceCents: priced.line.unitPriceCents });
    dialogRef.current?.close();
  }

  const titleId = `item-title-${product.id}`;

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onClose={onClose}
      className="m-auto w-full max-w-md rounded-lg bg-background p-0 text-foreground backdrop:bg-black/50"
    >
      <div className="flex max-h-[85dvh] flex-col gap-4 overflow-y-auto p-4">
        <div className="flex items-start justify-between gap-3">
          <h2 id={titleId} className="text-lg font-semibold">
            {product.name}
          </h2>
          <button type="button" onClick={() => dialogRef.current?.close()} className="text-sm underline">
            Fechar
          </button>
        </div>
        {product.description && <p className="text-sm text-neutral-700 dark:text-neutral-300">{product.description}</p>}

        {sizes.length > 0 && (
          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium">Tamanho</legend>
            {sizes.map((item) => {
              const price = product.sizePrices.find((candidate) => candidate.sizeId === item.id)!.priceCents;
              return (
                <label key={item.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="size"
                    checked={sizeId === item.id}
                    onChange={() => {
                      setSizeId(item.id);
                      setSecondFlavorId("");
                    }}
                  />
                  {`${item.name} — ${formatBRL(price)}`}
                </label>
              );
            })}
          </fieldset>
        )}

        {halfAllowed && secondFlavors.length > 0 && (
          <label className="flex flex-col gap-1 text-sm">
            Segundo sabor (opcional)
            <select
              value={secondFlavorId}
              onChange={(event) => setSecondFlavorId(event.target.value)}
              className="rounded border border-neutral-300 bg-background px-3 py-2 dark:border-neutral-700"
            >
              <option value="">Só {product.name}</option>
              {secondFlavors.map((flavor) => (
                <option key={flavor.id} value={flavor.id}>
                  {flavor.name}
                </option>
              ))}
            </select>
          </label>
        )}

        {groups.map((group) => (
          <fieldset key={group.id} className="flex flex-col gap-2">
            <legend className="text-sm font-medium">
              {group.name}
              <span className="ml-2 font-normal text-neutral-700 dark:text-neutral-300">
                {group.minSelect > 0 ? `(obrigatório, até ${group.maxSelect})` : `(até ${group.maxSelect})`}
              </span>
            </legend>
            {group.maxSelect === 1 && group.minSelect === 0 && (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name={`group-${group.id}`}
                  checked={!group.options.some((option) => optionIds.includes(option.id))}
                  onChange={() => toggleOption(group, "", false)}
                />
                Nenhuma
              </label>
            )}
            {group.options.map((option) => {
              const checked = optionIds.includes(option.id);
              const selectedInGroup = group.options.filter((item) => optionIds.includes(item.id)).length;
              const label = `${option.name}${option.priceCents > 0 ? ` + ${formatBRL(option.priceCents)}` : ""}${option.available ? "" : " (esgotado)"}`;
              return (
                <label key={option.id} className="flex items-center gap-2 text-sm">
                  <input
                    type={group.maxSelect === 1 ? "radio" : "checkbox"}
                    name={`group-${group.id}`}
                    checked={checked}
                    disabled={!option.available || (group.maxSelect > 1 && !checked && selectedInGroup >= group.maxSelect)}
                    onChange={(event) => toggleOption(group, option.id, event.target.checked)}
                  />
                  {label}
                </label>
              );
            })}
          </fieldset>
        ))}

        <div className="flex items-center gap-3">
          <button type="button" aria-label="Diminuir quantidade" onClick={() => setQuantity((q) => Math.max(1, q - 1))} className="rounded border px-3 py-1">
            −
          </button>
          <output aria-label="Quantidade" className="min-w-6 text-center">
            {quantity}
          </output>
          <button
            type="button"
            aria-label="Aumentar quantidade"
            onClick={() => setQuantity((q) => Math.min(MAX_ITEM_QUANTITY, q + 1))}
            className="rounded border px-3 py-1"
          >
            +
          </button>
        </div>

        <label className="flex flex-col gap-1 text-sm">
          Observações
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            maxLength={140}
            rows={2}
            placeholder="Ex.: sem cebola"
            className="rounded border border-neutral-300 bg-background px-3 py-2 dark:border-neutral-700"
          />
        </label>

        {"error" in priced && (
          <p data-testid="item-error" className="text-sm text-red-700 dark:text-red-400">
            {priced.error}
          </p>
        )}

        <button
          type="button"
          onClick={addToCart}
          disabled={!("line" in priced)}
          className="rounded bg-(--brand-primary) px-4 py-3 font-semibold text-(--brand-primary-foreground) disabled:opacity-50"
        >
          {"line" in priced ? `Adicionar · ${formatBRL(priced.line.totalCents)}` : "Adicionar"}
        </button>
      </div>
    </dialog>
  );
}
