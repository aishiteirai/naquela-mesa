import { cacheLife, cacheTag } from "next/cache";
import { getMenu } from "@/modules/catalog";
import { getStoreBySlug } from "@/modules/stores";

export function storeMenuTag(slug: string): string {
  return `store-menu:${slug}`;
}

export async function getStorePageData(slug: string) {
  "use cache";
  cacheTag(storeMenuTag(slug));
  cacheLife("hours");

  const store = await getStoreBySlug(slug);
  if (!store) return null;
  const menu = await getMenu(store.id);
  return { store, menu };
}
