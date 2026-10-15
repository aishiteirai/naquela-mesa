"use client";

import { useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { ITEM_PARAM, parseItemParam } from "@/app/[slug]/_lib/item-param";
import { ItemSheet } from "./item-sheet";
import { closeItem } from "./item-url";
import { usePricingContext } from "./menu-provider";

export function ItemParamController() {
  const searchParams = useSearchParams();
  const { menu } = usePricingContext();
  const value = searchParams.get(ITEM_PARAM);
  const product = parseItemParam(value, menu.categories);

  useEffect(() => {
    if (value && !product) closeItem();
  }, [value, product]);

  if (!product) return null;
  return <ItemSheet key={product.id} productId={product.id} onClose={closeItem} />;
}
