"use server";

import { updateTag } from "next/cache";
import { z } from "zod";
import { setOptionAvailability, setProductAvailability } from "@/modules/catalog";
import { storeMenuTag } from "@/modules/stores";
import { isDomainError } from "@/shared/errors";
import { requireStoreAccess } from "@/app/painel/_lib/access";

async function toggle(work: (storeId: string) => Promise<void>): Promise<void> {
  const { store } = await requireStoreAccess();
  try {
    await work(store.id);
  } catch (error) {
    // Item de outra loja ou removido: nada a fazer; a tela recarrega com o estado real.
    if (isDomainError(error) && error.code === "NOT_FOUND") return;
    throw error;
  }
  updateTag(storeMenuTag(store.slug));
}

export async function toggleProductAvailabilityAction(form: FormData): Promise<void> {
  await toggle(async (storeId) => {
    const id = z.uuid().safeParse(String(form.get("productId")));
    if (!id.success) return;
    await setProductAvailability(storeId, id.data, form.get("available") === "true");
  });
}

export async function toggleOptionAvailabilityAction(form: FormData): Promise<void> {
  await toggle(async (storeId) => {
    const id = z.uuid().safeParse(String(form.get("optionId")));
    if (!id.success) return;
    await setOptionAvailability(storeId, id.data, form.get("available") === "true");
  });
}
