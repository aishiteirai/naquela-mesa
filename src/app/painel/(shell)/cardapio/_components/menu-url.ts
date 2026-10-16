"use client";

import { createUrlOverlay, replaceParams } from "@/lib/url-overlay";

// Painel lateral do produto controlado pela URL (?produto= / ?novo=).
const overlay = createUrlOverlay(["produto", "novo"]);

/** Troca a categoria selecionada sem nova entrada no histórico. */
export function selectCategory(categoryId: string): void {
  replaceParams({ categoria: categoryId });
}

export function openProduct(productId: string): void {
  overlay.open({ produto: productId, novo: null });
}

export function openNewProduct(categoryId: string): void {
  overlay.open({ categoria: categoryId, novo: categoryId, produto: null });
}

export function closeProductPanel(): void {
  overlay.close();
}
