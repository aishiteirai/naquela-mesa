"use client";

import { useState } from "react";
import { ItemDialog } from "./item-dialog";

export function AddToCartButton({ productId, productName }: { productId: string; productName: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        aria-label={`Adicionar ${productName}`}
        onClick={() => setOpen(true)}
        className="rounded-full bg-(--brand-primary) px-4 py-1.5 text-sm font-semibold text-(--brand-primary-foreground)"
      >
        Adicionar
      </button>
      {open && <ItemDialog productId={productId} onClose={() => setOpen(false)} />}
    </>
  );
}
