import { ensureUser } from "@/modules/auth";
import { getMenu, importCatalog } from "@/modules/catalog";
import { importOrderHistory } from "@/modules/orders";
import { addStoreMember, createStore, deleteStoreBySlug, getStoreById, replaceStoreHours } from "@/modules/stores";
import { buildDemoHistory } from "./orders";
import { DEMO_OWNER, DEMO_STORE_SLUG, demoCatalog, demoHours, demoStore } from "./pizzaria-demo";

export async function seedDemoStore(): Promise<{ storeId: string; ownerUserId: string; historyCount: number }> {
  if (process.env.NODE_ENV === "production") throw new Error("seed:demo não roda com NODE_ENV=production");
  // Apagar em cascata e recriar mantém o seed idempotente.
  await deleteStoreBySlug(DEMO_STORE_SLUG);
  const { id: storeId } = await createStore(demoStore);
  await replaceStoreHours(storeId, demoHours);
  await importCatalog(storeId, demoCatalog);
  const owner = await ensureUser(DEMO_OWNER);
  await addStoreMember(storeId, owner.id);

  const store = await getStoreById(storeId);
  if (!store) throw new Error("loja demo não encontrada após criar");
  const deliveryFeeCents = store.rules.deliveryFee.strategy === "fixed" ? store.rules.deliveryFee.fixedCents : 0;
  const history = buildDemoHistory({ menu: await getMenu(storeId), timeZone: store.timezone, now: new Date(), deliveryFeeCents });
  const historyCount = await importOrderHistory(storeId, history);

  return { storeId, ownerUserId: owner.id, historyCount };
}
