import { ensureUser } from "@/modules/auth";
import { importCatalog } from "@/modules/catalog";
import { addStoreMember, createStore, deleteStoreBySlug, replaceStoreHours } from "@/modules/stores";
import { DEMO_OWNER, DEMO_STORE_SLUG, demoCatalog, demoHours, demoStore } from "./pizzaria-demo";

export async function seedDemoStore(): Promise<{ storeId: string; ownerUserId: string }> {
  if (process.env.NODE_ENV === "production") throw new Error("seed:demo não roda com NODE_ENV=production");
  // Apagar em cascata e recriar mantém o seed idempotente.
  await deleteStoreBySlug(DEMO_STORE_SLUG);
  const { id: storeId } = await createStore(demoStore);
  await replaceStoreHours(storeId, demoHours);
  await importCatalog(storeId, demoCatalog);
  const owner = await ensureUser(DEMO_OWNER);
  await addStoreMember(storeId, owner.id);
  return { storeId, ownerUserId: owner.id };
}
