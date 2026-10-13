/** Tag de cache do cardápio público de uma loja. Invalidar com `updateTag` após qualquer edição visível. */
export function storeMenuTag(slug: string): string {
  return `store-menu:${slug}`;
}
