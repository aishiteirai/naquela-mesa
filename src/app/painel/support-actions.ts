"use server";

import { redirect } from "next/navigation";
import { recordAudit } from "@/modules/audit";
import { requireUser, stopImpersonation } from "@/modules/auth";
import { getMembershipStoreId, getStoreById } from "@/modules/stores";

export async function stopSupportAction(): Promise<void> {
  const user = await requireUser();
  if (!user.impersonatedBy) redirect("/painel");

  const storeId = await getMembershipStoreId(user.id);
  const store = storeId ? await getStoreById(storeId) : null;
  await recordAudit({
    actorUserId: user.impersonatedBy,
    action: "support_session_ended",
    storeId: store?.id ?? null,
    details: store ? { storeName: store.name, storeSlug: store.slug } : {},
  });
  await stopImpersonation();
  redirect("/admin");
}
