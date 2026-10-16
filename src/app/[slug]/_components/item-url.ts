"use client";

import { ITEM_PARAM } from "@/app/[slug]/_lib/item-param";
import { createUrlOverlay } from "@/lib/url-overlay";

const overlay = createUrlOverlay([ITEM_PARAM]);

export function openItem(productId: string): void {
  overlay.open({ [ITEM_PARAM]: productId }, { idempotent: true });
}

export function closeItem(): void {
  overlay.close();
}
