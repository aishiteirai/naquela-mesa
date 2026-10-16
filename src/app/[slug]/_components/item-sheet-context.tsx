"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { findOpenableProduct } from "@/app/[slug]/_lib/find-open-product";
import { ItemSheet } from "./item-sheet";
import { usePricingContext } from "./menu-provider";

type ItemSheetApi = { open: (productId: string) => void; close: () => void };

const ItemSheetContext = createContext<ItemSheetApi | null>(null);

export function ItemSheetProvider({ children }: { children: ReactNode }) {
  const { menu } = usePricingContext();
  const [openProductId, setOpenProductId] = useState<string | null>(null);
  const open = useCallback((productId: string) => setOpenProductId(productId), []);
  const close = useCallback(() => setOpenProductId(null), []);
  const api = useMemo(() => ({ open, close }), [open, close]);
  const product = findOpenableProduct(openProductId, menu.categories);

  return (
    <ItemSheetContext value={api}>
      {children}
      {product && <ItemSheet key={product.id} productId={product.id} onClose={close} />}
    </ItemSheetContext>
  );
}

export function useItemSheet(): ItemSheetApi {
  const value = useContext(ItemSheetContext);
  if (!value) throw new Error("useItemSheet fora do ItemSheetProvider");
  return value;
}
