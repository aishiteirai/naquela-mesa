"use server";

import { saveImage } from "@/modules/media";
import { isDomainError } from "@/shared/errors";
import { requireStoreAccess } from "@/app/painel/_lib/access";

export type UploadResult = { url: string } | { error: string };

export async function uploadImageAction(form: FormData): Promise<UploadResult> {
  await requireStoreAccess();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Selecione uma imagem." };

  try {
    return await saveImage(new Uint8Array(await file.arrayBuffer()));
  } catch (error) {
    if (isDomainError(error) && error.code === "VALIDATION") {
      const [issue] = error.details.issues as { message: string }[];
      return { error: issue?.message ?? "Imagem inválida." };
    }
    throw error;
  }
}
