import { importCatalog } from "@/modules/catalog";
import { createStore, deleteStoreBySlug, replaceStoreHours } from "@/modules/stores";
import { DEMO_STORE_SLUG, demoCatalog, demoHours, demoStore } from "./pizzaria-demo";

export async function seedDemoStore(): Promise<{ storeId: string }> {
  if (process.env.NODE_ENV === "production") throw new Error("seed:demo não roda com NODE_ENV=production");
  // Apagar em cascata e recriar mantém o seed idempotente.
  await deleteStoreBySlug(DEMO_STORE_SLUG);
  const { id: storeId } = await createStore(demoStore);
  await replaceStoreHours(storeId, demoHours);
  await importCatalog(storeId, demoCatalog);
  return { storeId };
}
