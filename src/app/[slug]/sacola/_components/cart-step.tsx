"use client";

import Link from "next/link";
import type { Ref } from "react";
import { Button } from "@/components/ui/button";
import { formatBRL } from "@/shared/money";
import { useCart } from "@/app/[slug]/_components/cart-context";

export function CartStep({ hidden, slug, onCartChange, ref }: { hidden: boolean; slug: string; onCartChange: () => void; ref: Ref<HTMLFieldSetElement> }) {
  const cart = useCart();

  return (
    <fieldset ref={ref} hidden={hidden} className="flex flex-col gap-3">
      <legend className="sr-only">Itens da sacola</legend>
      <ul className="flex flex-col divide-y rounded-xl border bg-card">
        {cart.lines.map((line) => (
          <li key={line.key} className="flex flex-col gap-2 p-3">
            <div className="flex justify-between gap-3">
              <span className="font-medium">{line.label}</span>
              <span className="font-semibold whitespace-nowrap">{formatBRL(line.unitPriceCents * line.input.quantity)}</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                aria-label={`Diminuir ${line.label}`}
                onClick={() => {
                  onCartChange();
                  cart.setQuantity(line.key, line.input.quantity - 1);
                }}
              >
                −
              </Button>
              <span className="min-w-6 text-center">{line.input.quantity}</span>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                aria-label={`Aumentar ${line.label}`}
                onClick={() => {
                  onCartChange();
                  cart.setQuantity(line.key, line.input.quantity + 1);
                }}
              >
                +
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="ml-auto"
                aria-label={`Remover ${line.label}`}
                onClick={() => {
                  onCartChange();
                  cart.remove(line.key);
                }}
              >
                Remover
              </Button>
            </div>
          </li>
        ))}
      </ul>
      <Button asChild variant="outline">
        <Link href={`/${slug}`}>Adicionar mais itens</Link>
      </Button>
    </fieldset>
  );
}
