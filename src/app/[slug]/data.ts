import { cacheLife, cacheTag } from "next/cache";
import { getMenu } from "@/modules/catalog";
import { getDeliveryZones, getStoreBySlug, storeMenuTag } from "@/modules/stores";

export async function getStorePageData(slug: string) {
  "use cache";
  cacheTag(storeMenuTag(slug));
  cacheLife("hours");

  const store = await getStoreBySlug(slug);
  if (!store) return null;
  const [menu, zones] = await Promise.all([getMenu(store.id), getDeliveryZones(store.id)]);
  return { store, menu, zones };
}
