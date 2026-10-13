import { importCatalog } from "@/modules/catalog";
import { createStore, deleteStoreBySlug, replaceStoreHours } from "@/modules/stores";
import { DEMO_STORE_SLUG, demoCatalog, demoHours, demoStore } from "./pizzaria-demo";

export async function seedDemoStore(): Promise<{ storeId: string }> {
  // Apagar em cascata e recriar mantém o seed idempotente.
  await deleteStoreBySlug(DEMO_STORE_SLUG);
  const { id: storeId } = await createStore(demoStore);
  await replaceStoreHours(storeId, demoHours);
  await importCatalog(storeId, demoCatalog);
  return { storeId };
}
