"use client";

import { uuid } from "@/shared/uuid";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { MAX_ITEM_QUANTITY } from "@/modules/orders/client";
import { addCartLine, parseStoredCart, type CartLine } from "./cart-storage";

export type { CartLine };

type CartValue = {
  lines: CartLine[];
  ready: boolean;
  count: number;
  estimatedSubtotalCents: number;
  add(line: Omit<CartLine, "key">): void;
  setQuantity(key: string, quantity: number): void;
  remove(key: string): void;
  clear(): void;
};

const CartContext = createContext<CartValue | null>(null);

function storageKey(slug: string): string {
  return `naquela-mesa:sacola:${slug}`;
}

function readStored(slug: string): CartLine[] {
  try {
    return parseStoredCart(window.localStorage.getItem(storageKey(slug)));
  } catch {
    return [];
  }
}

export function CartProvider({ slug, children }: { slug: string; children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Leitura do localStorage só após hidratar (evita mismatch SSR).
    /* eslint-disable react-hooks/set-state-in-effect */
    setLines(readStored(slug));
    setReady(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [slug]);

  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(storageKey(slug), JSON.stringify(lines));
    } catch {
      // Armazenamento indisponível (modo privado): a sacola vale só nesta página.
    }
  }, [lines, ready, slug]);

  const add = useCallback((line: Omit<CartLine, "key">) => {
    setLines((current) => addCartLine(current, { ...line, key: uuid() }));
  }, []);

  const setQuantity = useCallback((key: string, quantity: number) => {
    setLines((current) =>
      quantity < 1
        ? current.filter((line) => line.key !== key)
        : current.map((line) =>
            line.key === key ? { ...line, input: { ...line.input, quantity: Math.min(quantity, MAX_ITEM_QUANTITY) } } : line,
          ),
    );
  }, []);

  const remove = useCallback((key: string) => setLines((current) => current.filter((line) => line.key !== key)), []);
  const clear = useCallback(() => setLines([]), []);

  const value = useMemo<CartValue>(
    () => ({
      lines,
      ready,
      count: lines.reduce((sum, line) => sum + line.input.quantity, 0),
      estimatedSubtotalCents: lines.reduce((sum, line) => sum + line.unitPriceCents * line.input.quantity, 0),
      add,
      setQuantity,
      remove,
      clear,
    }),
    [lines, ready, add, setQuantity, remove, clear],
  );

  return <CartContext value={value}>{children}</CartContext>;
}

export function useCart(): CartValue {
  const value = useContext(CartContext);
  if (!value) throw new Error("CartProvider ausente");
  return value;
}
