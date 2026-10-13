import { cache } from "react";
import { redirect } from "next/navigation";
import { isSuperAdmin, requireUser, type SessionUser } from "@/modules/auth";
import { getMembershipStoreId, getStoreById, type Store } from "@/modules/stores";

export type StoreAccess = { user: SessionUser; store: Store };

/** Única fonte do storeId no painel: a sessão. Use no início de toda página e Server Action do painel. */
export const requireStoreAccess = cache(async (): Promise<StoreAccess> => {
  const user = await requireUser();
  const storeId = await getMembershipStoreId(user.id);
  if (!storeId) redirect(isSuperAdmin(user) ? "/admin" : "/sem-loja");

  const store = await getStoreById(storeId);
  if (!store) redirect("/sem-loja");
  return { user, store };
});
