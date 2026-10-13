"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { PricingContext } from "@/modules/orders/client";

const MenuContext = createContext<PricingContext | null>(null);

export function MenuProvider({ value, children }: { value: PricingContext; children: ReactNode }) {
  return <MenuContext value={value}>{children}</MenuContext>;
}

export function usePricingContext(): PricingContext {
  const value = useContext(MenuContext);
  if (!value) throw new Error("MenuProvider ausente");
  return value;
}
