"use client";

import Image from "next/image";
import { ArrowLeftIcon, MinusIcon, PlusIcon } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { MenuOptionGroup, MenuProduct } from "@/modules/catalog";
import { describeLine, MAX_ITEM_QUANTITY, priceItem, type CartItemInput, type PricedLine } from "@/modules/orders/client";
import { isDomainError } from "@/shared/errors";
import { formatBRL } from "@/shared/money";
import { useCart } from "./cart-context";
import { AddonGroupSection, FlavorSection, SizeSection } from "./item-options";
import { usePricingContext } from "./menu-provider";

function errorText(error: unknown): string {
  if (!isDomainError(error)) return "Não foi possível calcular o preço.";
  if (error.code === "INVALID_OPTIONS") return String(error.details.reason ?? "Revise as opções.");
  if (error.code === "ITEM_UNAVAILABLE") return `${String(error.details.name ?? "Item")} está esgotado.`;
  return "Revise as opções.";
}

export function ItemSheet({ productId, onClose }: { productId: string; onClose: () => void }) {
  const ctx = usePricingContext();
  const cart = useCart();

  const category = ctx.menu.categories.find((item) => item.products.some((product) => product.id === productId))!;
  const product = category.products.find((item) => item.id === productId)!;
  const sizes = category.sizes.filter((size) => product.sizePrices.some((price) => price.sizeId === size.id));

  const [sizeId, setSizeId] = useState(sizes[0]?.id ?? "");
  const [secondFlavorId, setSecondFlavorId] = useState("");
  const [optionIds, setOptionIds] = useState<string[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");

  const size = sizes.find((item) => item.id === sizeId);
  const halfAllowed = Boolean(size && size.maxFlavors > 1 && product.allowsHalf && ctx.halfAndHalfEnabled);
  const secondFlavors: MenuProduct[] = halfAllowed
    ? category.products.filter(
        (item) => item.id !== product.id && item.allowsHalf && item.available && item.sizePrices.some((price) => price.sizeId === sizeId),
      )
    : [];
  const flavorIds = halfAllowed && secondFlavorId ? [product.id, secondFlavorId] : [product.id];

  const groups: MenuOptionGroup[] = ctx.addonsEnabled
    ? [...new Set(flavorIds.flatMap((id) => category.products.find((item) => item.id === id)?.optionGroupIds ?? []))]
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

  const added = useRef(false);

  function addToCart() {
    if (added.current || !("line" in priced)) return;
    added.current = true;
    cart.add({ input, label: describeLine(priced.line), unitPriceCents: priced.line.unitPriceCents });
    toast.success(`${product.name} adicionado à sacola`);
    onClose();
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="inset-0 top-0 left-0 flex h-dvh max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none bg-background p-0 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:h-auto sm:max-h-[90dvh] sm:max-w-xl sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl"
      >
        <div className="relative shrink-0">
          {product.imageUrl ? (
            <div className="relative aspect-video w-full bg-muted">
              <Image src={product.imageUrl} alt="" fill unoptimized className="object-cover" />
            </div>
          ) : (
            <div aria-hidden="true" className="flex h-24 items-end bg-primary px-4 pb-3 text-primary-foreground">
              <span className="text-xl font-bold [font-family:var(--heading-font)]">{product.name}</span>
            </div>
          )}
          <Button
            type="button"
            variant="secondary"
            size="icon"
            aria-label="Voltar ao cardápio"
            onClick={onClose}
            className="absolute top-3 left-3 rounded-full shadow-md"
          >
            <ArrowLeftIcon />
          </Button>
        </div>

        <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-4">
          <div className="flex flex-col gap-1">
            <DialogTitle className={product.imageUrl ? "text-xl font-bold" : "sr-only"}>{product.name}</DialogTitle>
            <DialogDescription className={product.description ? undefined : "sr-only"}>
              {product.description ?? "Monte o item e adicione à sacola."}
            </DialogDescription>
          </div>

          {sizes.length > 0 && (
            <SizeSection
              sizes={sizes}
              product={product}
              value={sizeId}
              onChange={(id) => {
                setSizeId(id);
                setSecondFlavorId("");
              }}
            />
          )}

          {halfAllowed && secondFlavors.length > 0 && <FlavorSection flavors={secondFlavors} value={secondFlavorId} onChange={setSecondFlavorId} />}

          {groups.map((group) => (
            <AddonGroupSection
              key={group.id}
              group={group}
              selected={optionIds}
              onToggle={(optionId, checked) => toggleOption(group, optionId, checked)}
            />
          ))}

          <div className="flex flex-col gap-2">
            <Label htmlFor={`notes-${product.id}`}>Observações</Label>
            <Textarea
              id={`notes-${product.id}`}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              maxLength={140}
              rows={2}
              placeholder="Ex.: sem cebola"
            />
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-2 border-t bg-background p-4">
          {"error" in priced && (
            <p data-testid="item-error" className="text-sm text-destructive">
              {priced.error}
            </p>
          )}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 rounded-lg border p-1">
              <Button type="button" variant="ghost" size="icon-sm" aria-label="Diminuir quantidade" onClick={() => setQuantity((q) => Math.max(1, q - 1))}>
                <MinusIcon />
              </Button>
              <output aria-label="Quantidade" className="min-w-6 text-center font-medium">
                {quantity}
              </output>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Aumentar quantidade"
                onClick={() => setQuantity((q) => Math.min(MAX_ITEM_QUANTITY, q + 1))}
              >
                <PlusIcon />
              </Button>
            </div>
            <Button type="button" size="lg" className="flex-1" onClick={addToCart} disabled={!("line" in priced)}>
              {"line" in priced ? `Adicionar · ${formatBRL(priced.line.totalCents)}` : "Adicionar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
