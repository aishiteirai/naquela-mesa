"use client";

import { Button } from "@/components/ui/button";
import { openItem } from "./item-url";

export function AddToCartButton({ productId, productName }: { productId: string; productName: string }) {
  return (
    <Button type="button" size="sm" className="rounded-full" aria-label={`Adicionar ${productName}`} onClick={() => openItem(productId)}>
      Adicionar
    </Button>
  );
}
