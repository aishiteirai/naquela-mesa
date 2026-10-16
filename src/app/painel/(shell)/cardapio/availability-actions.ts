"use server";

import { updateTag } from "next/cache";
import { z } from "zod";
import { setOptionAvailability, setProductAvailability } from "@/modules/catalog";
import { storeMenuTag } from "@/modules/stores";
import { isDomainError } from "@/shared/errors";
import { requireStoreAccess } from "@/app/painel/_lib/access";

export type AvailabilityResult = { ok: boolean };

// ok=false: id inválido ou item de outra loja/removido (nada foi alterado).
async function toggle(work: (storeId: string) => Promise<boolean>): Promise<AvailabilityResult> {
  const { store } = await requireStoreAccess();
  try {
    if (!(await work(store.id))) return { ok: false };
  } catch (error) {
    if (isDomainError(error) && error.code === "NOT_FOUND") return { ok: false };
    throw error;
  }
  updateTag(storeMenuTag(store.slug));
  return { ok: true };
}

export async function toggleProductAvailabilityAction(form: FormData): Promise<AvailabilityResult> {
  return toggle(async (storeId) => {
    const id = z.uuid().safeParse(String(form.get("productId")));
    if (!id.success) return false;
    await setProductAvailability(storeId, id.data, form.get("available") === "true");
    return true;
  });
}

export async function toggleOptionAvailabilityAction(form: FormData): Promise<AvailabilityResult> {
  return toggle(async (storeId) => {
    const id = z.uuid().safeParse(String(form.get("optionId")));
    if (!id.success) return false;
    await setOptionAvailability(storeId, id.data, form.get("available") === "true");
    return true;
  });
}
